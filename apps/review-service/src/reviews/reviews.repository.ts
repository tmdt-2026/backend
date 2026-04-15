import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Review, Prisma } from '@prisma/review-client';

export interface RatingStats {
  productId: string;
  average: number;
  totalCount: number;
  distribution: { five: number; four: number; three: number; two: number; one: number };
  percentages: { five: number; four: number; three: number; two: number; one: number };
}

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ReviewCreateInput): Promise<Review> {
    return this.prisma.review.create({ data });
  }

  async findByUniqueKey(userId: string, productId: string, orderId: string): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { userId_productId_orderId: { userId, productId, orderId } },
    });
  }

  async findById(id: string): Promise<Review | null> {
    return this.prisma.review.findUnique({ where: { id } });
  }

  async findByProduct(
    productId: string,
    params: {
      skip?: number;
      take?: number;
      where?: Prisma.ReviewWhereInput;
      orderBy?: Prisma.ReviewOrderByWithRelationInput;
    },
  ): Promise<[Review[], number]> {
    const baseWhere: Prisma.ReviewWhereInput = {
      productId,
      isVisible: true,
      ...params.where,
    };
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where: baseWhere,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
      }),
      this.prisma.review.count({ where: baseWhere }),
    ]);
  }

  async findByUser(userId: string, skip: number, take: number): Promise<[Review[], number]> {
    const where: Prisma.ReviewWhereInput = { userId };
    return this.prisma.$transaction([
      this.prisma.review.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.review.count({ where }),
    ]);
  }

  async findAllAdmin(
    params: {
      skip?: number;
      take?: number;
      where?: Prisma.ReviewWhereInput;
      orderBy?: Prisma.ReviewOrderByWithRelationInput;
    },
  ): Promise<[Review[], number]> {
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
      }),
      this.prisma.review.count({ where: params.where }),
    ]);
  }

  async getRatingStats(productId: string): Promise<RatingStats> {
    const [stats, distribution] = await Promise.all([
      this.prisma.review.aggregate({
        where: { productId, isVisible: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
      (this.prisma.review as any).groupBy({
        by: ['rating'],
        where: { productId, isVisible: true },
        _count: { id: true },
        orderBy: { rating: 'desc' },
      }),
    ]);

    const totalCount = stats._count.id;
    const average = stats._avg.rating ?? 0;

    const ratingMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
      ratingMap[d.rating] = d._count.id;
    });

    const pct = (n: number) => (totalCount ? Math.round((n / totalCount) * 100) : 0);

    return {
      productId,
      average: parseFloat(average.toFixed(1)),
      totalCount,
      distribution: {
        five: ratingMap[5],
        four: ratingMap[4],
        three: ratingMap[3],
        two: ratingMap[2],
        one: ratingMap[1],
      },
      percentages: {
        five: pct(ratingMap[5]),
        four: pct(ratingMap[4]),
        three: pct(ratingMap[3]),
        two: pct(ratingMap[2]),
        one: pct(ratingMap[1]),
      },
    };
  }

  async updateVisibility(id: string, isVisible: boolean, adminNote?: string): Promise<Review> {
    return this.prisma.review.update({
      where: { id },
      data: { isVisible, adminNote: adminNote ?? null },
    });
  }
}
