import { IsString, IsEnum, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { SettingType } from '@prisma/config-client';

export class UpdateSettingDto {
  @IsString()
  value: string;

  @IsOptional()
  @IsEnum(SettingType)
  settingType?: SettingType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  isPublic?: boolean;
}
