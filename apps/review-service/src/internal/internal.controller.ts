import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ReviewsRepository } from '../reviews/reviews.repository';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';

@Controller('internal/reviews')
@UseGuards(ServiceAuthGuard)
export class InternalController {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  @Get('products/:productId/stats')
  async getProductStats(@Param('productId', ParseUUIDPipe) productId: string) {
    const stats = await this.reviewsRepository.getRatingStats(productId);
    return {
      productId: stats.productId,
      average: stats.average,
      total: stats.totalCount,
    };
  }
}
