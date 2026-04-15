import {
  Injectable, Logger, NotFoundException, ConflictException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { SettingType, Setting } from '@prisma/config-client';
import { CacheService } from '../cache/cache.service';
import { ConfigPublisher } from '../publishers/config.publisher';
import { SettingsRepository } from './settings.repository';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

export type ParsedSettings = Record<string, string | number | boolean | unknown | null>;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  private readonly PROTECTED_KEYS = new Set([
    'maintenance_mode', 'site_name', 'logo_url', 'favicon_url',
    'hotline', 'shipping_free_threshold', 'max_cart_items',
  ]);

  private readonly CRITICAL_KEYS = [
    'maintenance_mode', 'shipping_free_threshold', 'max_cart_items', 'site_name',
  ];

  constructor(
    private readonly repo: SettingsRepository,
    private readonly cache: CacheService,
    private readonly publisher: ConfigPublisher,
  ) {}

  // ── PUBLIC SETTINGS ──────────────────────────────────────────────────────

  async getPublicSettings(): Promise<ParsedSettings> {
    const cacheKey = 'settings:public';
    const cached = this.cache.get<ParsedSettings>(cacheKey);
    if (cached) return cached;

    const settings = await this.repo.findAll({ isPublic: true });
    const parsed = this.parseSettings(settings);
    this.cache.set(cacheKey, parsed, 300); // 5 min
    return parsed;
  }

  // ── BY KEY ───────────────────────────────────────────────────────────────

  async findByKey(key: string, isAdmin: boolean): Promise<Setting> {
    const cacheKey = `setting:${key}`;
    const cached = this.cache.get<Setting>(cacheKey);
    if (cached) {
      if (!isAdmin && !cached.isPublic) throw new ForbiddenException({ code: 'SETTING_NOT_PUBLIC', message: 'Setting không công khai' });
      return cached;
    }

    const setting = await this.repo.findByKey(key);
    if (!setting) throw new NotFoundException({ code: 'SETTING_NOT_FOUND', message: `Setting '${key}' không tồn tại` });
    if (!isAdmin && !setting.isPublic) throw new ForbiddenException({ code: 'SETTING_NOT_PUBLIC', message: 'Setting không công khai' });

    this.cache.set(cacheKey, setting, 300);
    return setting;
  }

  // ── BY GROUP ─────────────────────────────────────────────────────────────

  async findByGroup(group: string, includePrivate: boolean, isAdmin: boolean): Promise<Setting[]> {
    const cacheKey = `settings:group:${group}${includePrivate ? ':all' : ''}`;
    const cached = this.cache.get<Setting[]>(cacheKey);
    if (cached) return cached;

    const canSeePrivate = isAdmin && includePrivate;
    const settings = await this.repo.findByGroup(group, canSeePrivate);
    this.cache.set(cacheKey, settings, 300);
    return settings;
  }

  // ── CREATE ───────────────────────────────────────────────────────────────

  async create(dto: CreateSettingDto, adminId: string): Promise<Setting> {
    if (!/^[a-z][a-z0-9_]*$/.test(dto.key)) {
      throw new BadRequestException({ code: 'INVALID_KEY_FORMAT', message: 'Key phải là snake_case' });
    }

    const exists = await this.repo.findByKey(dto.key);
    if (exists) throw new ConflictException({ code: 'SETTING_KEY_EXISTS', message: `Key '${dto.key}' đã tồn tại` });

    this.validateSettingValue(dto.value, dto.type);

    const setting = await this.repo.create({
      settingKey: dto.key,
      settingValue: dto.value,
      settingType: dto.type,
      group: dto.group,
      description: dto.description,
      isPublic: dto.isPublic ?? true,
      updatedBy: adminId,
    });

    this.invalidateSettingCache(dto.group, dto.key);
    return setting;
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────

  async update(key: string, dto: UpdateSettingDto, adminId: string): Promise<Setting> {
    const existing = await this.repo.findByKey(key);
    if (!existing) throw new NotFoundException({ code: 'SETTING_NOT_FOUND', message: `Setting '${key}' không tồn tại` });

    const typeToValidate = (dto.settingType ?? existing.settingType) as SettingType;
    this.validateSettingValue(dto.value, typeToValidate);

    const updated = await this.repo.update(key, {
      settingValue: dto.value,
      updatedBy: adminId,
      ...(dto.settingType  !== undefined ? { settingType:  dto.settingType }  : {}),
      ...(dto.description  !== undefined ? { description:  dto.description }  : {}),
      ...(dto.isPublic     !== undefined ? { isPublic:     dto.isPublic }     : {}),
    });

    this.invalidateSettingCache(existing.group, key);
    await this.publishSettingUpdated(key, existing.settingValue, dto.value, existing.group, adminId, updated.updatedAt);

    return updated;
  }

  // ── DELETE ───────────────────────────────────────────────────────────────

  async remove(key: string): Promise<void> {
    if (this.PROTECTED_KEYS.has(key)) {
      throw new ForbiddenException({ code: 'SETTING_PROTECTED', message: `Setting '${key}' là key hệ thống, không được xoá` });
    }

    const existing = await this.repo.findByKey(key);
    if (!existing) throw new NotFoundException({ code: 'SETTING_NOT_FOUND', message: `Setting '${key}' không tồn tại` });

    await this.repo.delete(key);
    this.invalidateSettingCache(existing.group, key);
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────

  parseSettings(settings: Setting[]): ParsedSettings {
    return Object.fromEntries(settings.map(s => [s.settingKey, this.parseValue(s)]));
  }

  private parseValue(s: Setting): string | number | boolean | unknown | null {
    if (s.settingValue === null) return null;
    switch (s.settingType) {
      case 'number':  return Number(s.settingValue);
      case 'boolean': return s.settingValue === 'true';
      case 'json': {
        try { return JSON.parse(s.settingValue); } catch { return s.settingValue; }
      }
      default: return s.settingValue;
    }
  }

  private validateSettingValue(value: string, type: SettingType): void {
    switch (type) {
      case SettingType.number:
        if (isNaN(Number(value)))
          throw new BadRequestException({ code: 'INVALID_SETTING_VALUE', message: `Giá trị '${value}' không phải number` });
        break;
      case SettingType.boolean:
        if (value !== 'true' && value !== 'false')
          throw new BadRequestException({ code: 'INVALID_SETTING_VALUE', message: `Giá trị boolean phải là 'true' hoặc 'false'` });
        break;
      case SettingType.json:
        try { JSON.parse(value); } catch {
          throw new BadRequestException({ code: 'INVALID_SETTING_VALUE', message: 'Giá trị không phải JSON hợp lệ' });
        }
        break;
      case SettingType.html:
        // Basic XSS check — reject if contains <script
        if (/<script/i.test(value))
          throw new BadRequestException({ code: 'UNSAFE_HTML', message: 'HTML chứa nội dung không an toàn' });
        break;
    }
  }

  private invalidateSettingCache(group: string, key: string): void {
    this.cache.delete(`setting:${key}`);
    this.cache.delete(`settings:group:${group}`);
    this.cache.delete(`settings:group:${group}:all`);
    this.cache.delete('settings:public');
  }

  private async publishSettingUpdated(
    key: string, oldValue: string | null, newValue: string,
    group: string, adminId: string, updatedAt: Date,
  ): Promise<void> {
    if (this.CRITICAL_KEYS.includes(key)) {
      await this.publisher.publish('config.setting_updated', {
        key, oldValue, newValue, group,
        updatedBy: adminId,
        updatedAt: updatedAt.toISOString(),
      });
    }

    if (key === 'maintenance_mode') {
      await this.publisher.publish('config.maintenance_changed', {
        isEnabled: newValue === 'true',
        updatedBy: adminId,
        updatedAt: updatedAt.toISOString(),
      });
    }
  }
}
