import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QuerySettingsByGroupDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includePrivate?: boolean = false;
}
