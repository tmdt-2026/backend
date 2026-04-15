import {
  IsString, IsOptional, IsBoolean, IsInt, IsUrl, IsDateString,
  Min, MaxLength, Matches, ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const VALID_POSITIONS = ['home_main', 'home_sub', 'category_top', 'popup', 'product_sidebar'];

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsUrl({}, { message: 'imageUrl phải là URL hợp lệ' })
  imageUrl: string;

  @IsOptional()
  @IsUrl({}, { message: 'mobileImageUrl phải là URL hợp lệ' })
  mobileImageUrl?: string;

  @IsOptional()
  @Matches(/^(https?:\/\/|\/|#)/, { message: 'targetUrl phải là URL đầy đủ, đường dẫn / hoặc anchor #' })
  targetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsString()
  @Matches(new RegExp(`^(${VALID_POSITIONS.join('|')})$`), {
    message: `position phải là một trong: ${VALID_POSITIONS.join(', ')}`,
  })
  position: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number = 0;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @ValidateIf(o => o.startDate !== undefined)
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  isActive?: boolean = true;
}
