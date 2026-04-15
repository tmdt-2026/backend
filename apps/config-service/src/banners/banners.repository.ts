import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Banner } from '@prisma/config-client';

@Injectable()
export class BannersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(position?: string): Promise<Banner[]> {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        ...(position ? { position } : {}),
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null },   { endDate:   { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findAll(where: { position?: string; isActive?: boolean }, skip: number, take: number): Promise<[Banner[], number]> {
    const whereClause = {
      ...(where.position  !== undefined ? { position:  where.position }  : {}),
      ...(where.isActive  !== undefined ? { isActive:  where.isActive }  : {}),
    };
    return Promise.all([
      this.prisma.banner.findMany({ where: whereClause, skip, take, orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.banner.count({ where: whereClause }),
    ]);
  }

  findById(id: string): Promise<Banner | null> {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  findByIds(ids: string[]): Promise<Banner[]> {
    return this.prisma.banner.findMany({ where: { id: { in: ids } } });
  }

  create(data: {
    title?: string; imageUrl: string; mobileImageUrl?: string; targetUrl?: string;
    altText?: string; position: string; sortOrder: number; startDate?: Date | null;
    endDate?: Date | null; isActive: boolean; createdBy?: string;
  }): Promise<Banner> {
    return this.prisma.banner.create({ data });
  }

  update(id: string, data: Partial<Banner>): Promise<Banner> {
    return this.prisma.banner.update({ where: { id }, data });
  }

  delete(id: string): Promise<Banner> {
    return this.prisma.banner.delete({ where: { id } });
  }

  increment(id: string, field: 'clickCount'): Promise<Banner> {
    return this.prisma.banner.update({ where: { id }, data: { [field]: { increment: 1 } } });
  }

  deactivateExpired(): Promise<{ count: number }> {
    return this.prisma.banner.updateMany({
      where: { isActive: true, endDate: { lt: new Date() } },
      data: { isActive: false },
    });
  }

  activateScheduled(): Promise<{ count: number }> {
    const now = new Date();
    return this.prisma.banner.updateMany({
      where: {
        isActive: false,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      data: { isActive: true },
    });
  }

  reorder(updates: { id: string; sortOrder: number }[]): Promise<void> {
    return this.prisma.$transaction(
      updates.map(({ id, sortOrder }) =>
        this.prisma.banner.update({ where: { id }, data: { sortOrder } })
      )
    ).then(() => undefined);
  }
}
