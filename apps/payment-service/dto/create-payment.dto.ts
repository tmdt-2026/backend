import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  amount: number;

  @IsString()
  orderId: string;

  // Only VNPay is supported. COD orders do not reach the payment service.
  @IsString()
  @IsIn(['vnpay'])
  paymentMethod: 'vnpay';

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  returnUrl?: string;

  @IsString()
  @IsOptional()
  notifyUrl?: string;
}