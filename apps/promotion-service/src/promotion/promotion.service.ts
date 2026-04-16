import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePromotionDto, UpdatePromotionDto, ApplyPromotionDto } from '../dto';
import { Promotion, DiscountType } from '@prisma/promotion-client';

@Injectable()
export class PromotionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    // Kiểm tra code đã tồn tại
    const existing = await this.prisma.promotion.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Mã voucher đã tồn tại');

    return this.prisma.promotion.create({ data: dto });
  }

  async findAll(query: any) {
    return this.prisma.promotion.findMany({
      where: { isActive: query.isActive !== undefined ? query.isActive : undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Không tìm thấy voucher');
    return promo;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    await this.findOne(id);
    return this.prisma.promotion.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.promotion.delete({ where: { id } });
  }

  async applyPromotion(dto: ApplyPromotionDto) {
    const promo = await this.prisma.promotion.findUnique({
      where: { code: dto.code, isActive: true },
    });

    if (!promo) throw new BadRequestException('Voucher không tồn tại hoặc đã hết hạn');
    if (new Date() < promo.startDate || new Date() > promo.endDate) {
      throw new BadRequestException('Voucher ngoài thời gian sử dụng');
    }
    if (dto.orderAmount < Number(promo.minOrderValue)) {
  throw new BadRequestException(
    `Đơn hàng tối thiểu ${promo.minOrderValue}`,
  );
}

let discountAmount = 0;

if (promo.discountType === DiscountType.PERCENTAGE) {
  discountAmount =
    (dto.orderAmount * Number(promo.discountValue)) / 100;

  if (promo.maxDiscount) {
    discountAmount = Math.min(
      discountAmount,
      Number(promo.maxDiscount),
    );
  }
} else {
  discountAmount = Number(promo.discountValue);
}

    return {
      promotionId: promo.id,
      code: promo.code,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalAmount: Number((dto.orderAmount - discountAmount).toFixed(2)),
    };
  }
}