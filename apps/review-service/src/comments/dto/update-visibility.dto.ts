import { IsBoolean, IsString, IsOptional, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCommentVisibilityDto {
  @IsBoolean()
  isVisible: boolean;

  @ValidateIf((o) => o.isVisible === false)
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  adminNote?: string;
}
