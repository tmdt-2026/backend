import { IsInt, Min, Max, IsString, MinLength, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AdjustmentDto {
  @IsInt()
  @Min(0)
  @Max(99999)
  @Type(() => Number)
  quantityAfter: number;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  note: string;
}
