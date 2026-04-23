import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ApplyPromotionDto,
  RecordPromotionUsageDto,
} from '../dto';
import { Promotion, DiscountType } from '@prisma/promotion-client';

@Injectable()
export class PromotionService {
  constructor(private prisma: PrismaService) {}

  private normalizeDateInput(value: string | Date | undefined, endOfDay = false) {
    if (!value) return value;
    if (value instanceof Date) return value;

    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return endOfDay
        ? new Date(`${raw}T23:59:59.999Z`)
        : new Date(`${raw}T00:00:00.000Z`);
    }

    return new Date(raw);
  }

  async findByCode(code: string) {
    if (!code) {
      return null;
    }

    return this.prisma.promotion.findUnique({
      where: { code, isActive: true },
    });
  }

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    // Kiểm tra code đã tồn tại
    const existing = await this.prisma.promotion.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Mã voucher đã tồn tại');

    return this.prisma.promotion.create({
      data: {
        ...dto,
        startDate: this.normalizeDateInput(dto.startDate, false) as Date,
        endDate: this.normalizeDateInput(dto.endDate, true) as Date,
      },
    });
  }

  async findAll(query: any) {
    const isActive =
      query?.isActive === undefined
        ? undefined
        : String(query.isActive).toLowerCase() === 'true';

    const promotions = await this.prisma.promotion.findMany({
      where: { isActive },
      include: {
        _count: {
          select: {
            usages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return promotions.map(({ _count, ...promotion }) => ({
      ...promotion,
      usedCount: _count.usages,
    }));
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Không tìm thấy voucher');
    return promo;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    await this.findOne(id);
    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startDate !== undefined
          ? { startDate: this.normalizeDateInput(dto.startDate, false) as Date }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: this.normalizeDateInput(dto.endDate, true) as Date }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.promotion.delete({ where: { id } });
  }

  async applyPromotion(dto: ApplyPromotionDto) {
    const normalizedCode = String(dto.code || '').trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('Vui lòng nhập mã voucher');
    }

    const promo = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode, isActive: true },
    });

    if (!promo) throw new BadRequestException('Voucher không tồn tại hoặc đã hết hạn');
    if (new Date() < promo.startDate || new Date() > promo.endDate) {
      throw new BadRequestException('Voucher ngoài thời gian sử dụng');
    }
    if (dto.orderAmount < Number(promo.minOrderValue)) {
      throw new BadRequestException(`Đơn hàng tối thiểu ${promo.minOrderValue}`);
    }

    const totalUsage = await this.prisma.promotionUsage.count({
      where: { promotionId: promo.id },
    });
    if (promo.usageLimit && totalUsage >= promo.usageLimit) {
      throw new BadRequestException('Voucher đã hết lượt sử dụng');
    }

    if (dto.userId && promo.perUserLimit) {
      const userUsage = await this.prisma.promotionUsage.count({
        where: {
          promotionId: promo.id,
          userId: dto.userId,
        },
      });
      if (userUsage >= promo.perUserLimit) {
        throw new BadRequestException('Bạn đã sử dụng hết lượt cho voucher này');
      }
    }

    let discountAmount = 0;

    if (promo.discountType === DiscountType.PERCENTAGE) {
      discountAmount = (dto.orderAmount * Number(promo.discountValue)) / 100;

      if (promo.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(promo.maxDiscount));
      }
    } else {
      discountAmount = Number(promo.discountValue);
    }

    const finalAmount = Math.max(0, dto.orderAmount - discountAmount);

    return {
      promotionId: promo.id,
      code: promo.code,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
    };
  }

  async recordPromotionUsage(dto: RecordPromotionUsageDto) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: dto.promotionId },
    });

    if (!promotion) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    if (!promotion.isActive) {
      throw new BadRequestException('Voucher không còn hiệu lực');
    }

    const now = new Date();
    if (now < promotion.startDate || now > promotion.endDate) {
      throw new BadRequestException('Voucher ngoài thời gian sử dụng');
    }

    return this.prisma.promotionUsage.upsert({
      where: {
        promotionId_userId: {
          promotionId: dto.promotionId,
          userId: dto.userId,
        },
      },
      create: {
        promotionId: dto.promotionId,
        userId: dto.userId,
        orderId: dto.orderId ?? null,
      },
      update: {
        orderId: dto.orderId ?? undefined,
      },
    });
  }
}