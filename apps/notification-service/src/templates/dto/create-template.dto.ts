import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsArray,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  htmlBody: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
