import { IsBoolean, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateModelDto {
  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  modelNumber?: string | null;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  cpu?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  screenSize?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  operaSystem?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
