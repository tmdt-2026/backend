import {
  IsString, IsOptional, IsBoolean, IsInt, IsUrl, IsDateString, Min, MaxLength, Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  mobileImageUrl?: string;

  @IsOptional()
  @Matches(/^(https?:\/\/|\/|#)/)
  targetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  isActive?: boolean;
}
