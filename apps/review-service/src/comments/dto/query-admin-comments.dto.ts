import { IsOptional, IsInt, Min, Max, IsBoolean, IsUUID, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryAdminCommentsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isVisible?: boolean;

  @IsOptional()
  @IsIn(['createdAt', 'depth'])
  sortBy?: 'createdAt' | 'depth' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
