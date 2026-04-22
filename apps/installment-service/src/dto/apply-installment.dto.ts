import { IsNumber, IsUUID, Min } from 'class-validator';

export class ApplyInstallmentDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  planId: string;

  @IsNumber()
  @Min(1)
  orderTotal: number;
}