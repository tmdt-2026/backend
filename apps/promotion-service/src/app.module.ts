import { Module } from '@nestjs/common';
import { PromotionController } from './promotion/promotion.controller';
import { PromotionMicroserviceController } from './promotion/promotion-microservice.controller';
import { PromotionService } from './promotion/promotion.service';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [PromotionController, PromotionMicroserviceController, HealthController],
  providers: [PromotionService, PrismaService],
})
export class AppModule {}
