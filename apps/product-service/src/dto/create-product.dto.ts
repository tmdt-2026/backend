import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  IsNotEmpty
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVariantDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  ram?: number;

  @IsOptional()
  @IsNumber()
  storage?: number;

  @IsNumber()
  @Min(0)
  importPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stockQuantity: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  modelId?: string; // Đã bỏ IsUUID để bạn dùng ID số 101, 102...

  @IsString()
  @IsNotEmpty()
  categoryId: string; // Đã bỏ IsUUID để bạn dùng ID số 1, 5, 6...

  @IsOptional()
  @IsString()
  imgUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto) // Rất quan trọng để NestJS hiểu nội dung mảng
  variants: CreateVariantDto[];
}