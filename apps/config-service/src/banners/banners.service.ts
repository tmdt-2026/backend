import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Banner } from '@prisma/config-client';
import { CacheService } from '../cache/cache.service';
import { ConfigPublisher } from '../publishers/config.publisher';
import { BannersRepository } from './banners.repository';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { QueryBannersDto } from './dto/query-banners.dto';
import { ReorderBannersDto } from './dto/reorder-banners.dto';

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);

  constructor(
    private readonly repo: BannersRepository,
    private readonly cache: CacheService,
    private readonly publisher: ConfigPublisher,
  ) {}

  // ── PUBLIC: ACTIVE BANNERS ────────────────────────────────────────────────

  async getActive(position?: string): Promise<Banner[]> {
    const cacheKey = `banners:${position ?? 'all'}`;
    const cached = this.cache.get<Banner[]>(cacheKey);
    if (cached) return cached;

    const banners = await this.repo.findActive(position);
    this.cache.set(cacheKey, banners, 120); // 2 min
    return banners;
  }

  // ── ADMIN: ALL BANNERS ────────────────────────────────────────────────────

  async getAll(query: QueryBannersDto) {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;
    const [banners, total] = await this.repo.findAll(
      { position: query.position, isActive: query.isActive },
      skip,
      take,
    );
    return { banners, total, page: query.page ?? 1, limit: take };
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreateBannerDto, createdBy: string): Promise<Banner> {
    if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'startDate phải trước endDate' });
    }

    const banner = await this.repo.create({
      title: dto.title,
      imageUrl: dto.imageUrl,
      mobileImageUrl: dto.mobileImageUrl,
      targetUrl: dto.targetUrl,
      altText: dto.altText,
      position: dto.position,
      sortOrder: dto.sortOrder ?? 0,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isActive: dto.isActive ?? true,
      createdBy,
    });

    this.cache.deleteByPattern(`banners:*`);
    await this.publisher.publish('config.banner_changed', {
      action: 'created', bannerId: banner.id, position: banner.position,
      updatedAt: banner.updatedAt.toISOString(),
    });

    return banner;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateBannerDto, updatedBy: string): Promise<Banner> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ code: 'BANNER_NOT_FOUND', message: 'Banner không tồn tại' });

    const startDate = dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : existing.startDate;
    const endDate   = dto.endDate   !== undefined ? (dto.endDate   ? new Date(dto.endDate)   : null) : existing.endDate;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'startDate phải trước endDate' });
    }

    const updated = await this.repo.update(id, {
      ...(dto.title           !== undefined ? { title: dto.title }                     : {}),
      ...(dto.imageUrl        !== undefined ? { imageUrl: dto.imageUrl }               : {}),
      ...(dto.mobileImageUrl  !== undefined ? { mobileImageUrl: dto.mobileImageUrl }   : {}),
      ...(dto.targetUrl       !== undefined ? { targetUrl: dto.targetUrl }             : {}),
      ...(dto.altText         !== undefined ? { altText: dto.altText }                 : {}),
      ...(dto.position        !== undefined ? { position: dto.position }               : {}),
      ...(dto.sortOrder       !== undefined ? { sortOrder: dto.sortOrder }             : {}),
      ...(dto.isActive        !== undefined ? { isActive: dto.isActive }               : {}),
      ...(dto.startDate       !== undefined ? { startDate }                            : {}),
      ...(dto.endDate         !== undefined ? { endDate }                              : {}),
    });

    this.cache.deleteByPattern('banners:*');
    await this.publisher.publish('config.banner_changed', {
      action: 'updated', bannerId: id, position: updated.position,
      updatedAt: updated.updatedAt.toISOString(),
    });

    return updated;
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ code: 'BANNER_NOT_FOUND', message: 'Banner không tồn tại' });

    await this.repo.delete(id);
    this.cache.deleteByPattern('banners:*');
    await this.publisher.publish('config.banner_changed', {
      action: 'deleted', bannerId: id, position: existing.position,
      updatedAt: new Date().toISOString(),
    });
  }

  // ── TOGGLE ────────────────────────────────────────────────────────────────

  async toggle(id: string, isActive: boolean): Promise<Banner> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ code: 'BANNER_NOT_FOUND', message: 'Banner không tồn tại' });

    const updated = await this.repo.update(id, { isActive });
    this.cache.deleteByPattern('banners:*');
    return updated;
  }

  // ── REORDER ───────────────────────────────────────────────────────────────

  async reorder(dto: ReorderBannersDto): Promise<{ message: string }> {
    const banners = await this.repo.findByIds(dto.orderedIds);
    const wrongPosition = banners.filter(b => b.position !== dto.position);
    if (wrongPosition.length > 0 || banners.length !== dto.orderedIds.length) {
      throw new BadRequestException({ code: 'BANNER_POSITION_MISMATCH', message: 'Một số banner không thuộc position này' });
    }

    await this.repo.reorder(dto.orderedIds.map((id, idx) => ({ id, sortOrder: idx + 1 })));
    this.cache.deleteByPattern('banners:*');

    return { message: `Đã sắp xếp lại ${dto.orderedIds.length} banners` };
  }

  // ── TRACK CLICK ───────────────────────────────────────────────────────────

  async trackClick(id: string): Promise<void> {
    const exists = await this.repo.findById(id);
    if (!exists) throw new NotFoundException({ code: 'BANNER_NOT_FOUND', message: 'Banner không tồn tại' });
    await this.repo.increment(id, 'clickCount');
    // No cache invalidation — clickCount is not in cached response
  }

  // ── CRON HELPERS ──────────────────────────────────────────────────────────

  async deactivateExpired(): Promise<number> {
    const result = await this.repo.deactivateExpired();
    if (result.count > 0) this.cache.deleteByPattern('banners:*');
    return result.count;
  }

  async activateScheduled(): Promise<number> {
    const result = await this.repo.activateScheduled();
    if (result.count > 0) this.cache.deleteByPattern('banners:*');
    return result.count;
  }
}
