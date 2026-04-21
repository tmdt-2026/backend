import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'])
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';

  @IsString()
  @IsOptional()
  note?: string;
}