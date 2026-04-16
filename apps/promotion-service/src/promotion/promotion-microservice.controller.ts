import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApplyPromotionDto } from '../dto';
import { PromotionService } from './promotion.service';

@Controller()
export class PromotionMicroserviceController {
  constructor(private readonly promotionService: PromotionService) {}

  @MessagePattern({ cmd: 'ping' })
  ping(@Payload() payload: unknown) {
    return {
      status: 'ok',
      service: 'promotion-service',
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  @MessagePattern({ cmd: 'promotion.apply' })
  apply(@Payload() dto: ApplyPromotionDto) {
    return this.promotionService.applyPromotion(dto);
  }

  @MessagePattern({ cmd: 'promotion.find-by-code' })
  findByCode(@Payload() payload: { code: string }) {
    return this.promotionService.findByCode(payload?.code);
  }
}
