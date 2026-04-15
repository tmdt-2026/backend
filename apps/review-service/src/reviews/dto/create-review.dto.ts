import { IsUUID, IsInt, Min, Max, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateReviewDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Nội dung đánh giá tối thiểu 10 ký tự' })
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  content?: string;
}
