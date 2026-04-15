import { IsString, IsEnum, IsOptional, IsBoolean, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { SettingType } from '@prisma/config-client';

export class CreateSettingDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'Key phải là snake_case: chữ thường, số và dấu gạch dưới' })
  @MaxLength(255)
  key: string;

  @IsString()
  value: string;

  @IsEnum(SettingType)
  type: SettingType;

  @IsEnum(['general', 'contact', 'social', 'policy', 'payment', 'notification'])
  group: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  isPublic?: boolean = true;
}
