import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() modelId?: string;
  @IsOptional() @IsString() imgUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
