import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateModelDto {
  @IsString()
  @IsNotEmpty()
  id: string; // Cho phép nhập ID thủ công (VD: 101, 102...)

  @IsString()
  @IsNotEmpty()
  modelName: string;

  @IsOptional()
  @IsString()
  modelNumber?: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsOptional()
  @IsString()
  cpu?: string;

  @IsOptional()
  @IsNumber()
  screenSize?: number;

  @IsOptional()
  @IsString()
  operaSystem?: string;
}