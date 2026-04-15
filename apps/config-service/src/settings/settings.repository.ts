import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Setting, SettingType } from '@prisma/config-client';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(where?: { isPublic?: boolean; group?: string }): Promise<Setting[]> {
    return this.prisma.setting.findMany({
      where,
      orderBy: [{ group: 'asc' }, { settingKey: 'asc' }],
    });
  }

  findByKey(key: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({ where: { settingKey: key } });
  }

  findByGroup(group: string, includePrivate: boolean): Promise<Setting[]> {
    return this.prisma.setting.findMany({
      where: { group, ...(includePrivate ? {} : { isPublic: true }) },
      orderBy: { settingKey: 'asc' },
    });
  }

  create(data: {
    settingKey: string;
    settingValue: string;
    settingType: SettingType;
    group: string;
    description?: string;
    isPublic: boolean;
    updatedBy: string;
  }): Promise<Setting> {
    return this.prisma.setting.create({ data });
  }

  update(
    key: string,
    data: Partial<{ settingValue: string; settingType: SettingType; description: string; isPublic: boolean; updatedBy: string }>,
  ): Promise<Setting> {
    return this.prisma.setting.update({ where: { settingKey: key }, data });
  }

  delete(key: string): Promise<Setting> {
    return this.prisma.setting.delete({ where: { settingKey: key } });
  }
}
