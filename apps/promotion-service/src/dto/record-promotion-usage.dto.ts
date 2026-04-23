import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordPromotionUsageDto {
  @IsUUID()
  promotionId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
