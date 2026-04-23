import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class ApplyInstallmentDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  planId: string;

  @IsNumber()
  @Min(1)
  orderTotal: number;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsString()
  @MinLength(8)
  phoneNumber: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  nationalId: string;

  @IsNumber()
  @Min(1)
  monthlyIncome: number;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsOptional()
  @IsString()
  applicationNote?: string;
}