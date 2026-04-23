import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateModelDto {
  @IsOptional()
  @IsUUID()
  id?: string;

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