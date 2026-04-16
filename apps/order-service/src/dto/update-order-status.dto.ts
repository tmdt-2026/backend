import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'processing', 'shipped', 'completed', 'cancelled'])
  status: 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';
}