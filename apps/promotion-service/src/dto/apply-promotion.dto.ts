import { IsOptional, IsString, IsNumber } from 'class-validator';

export class ApplyPromotionDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsNumber()
  orderAmount: number; // Tổng tiền đơn hàng trước giảm
}