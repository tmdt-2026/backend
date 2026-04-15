import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateThresholdDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  @Type(() => Number)
  lowStockThreshold: number;
}
