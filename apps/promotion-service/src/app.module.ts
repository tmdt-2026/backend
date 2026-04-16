import { Module } from '@nestjs/common';
import { PromotionController } from './promotion/promotion.controller';
import { PromotionService } from './promotion/promotion.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [PromotionController],
  providers: [PromotionService, PrismaService],
})
export class AppModule {}