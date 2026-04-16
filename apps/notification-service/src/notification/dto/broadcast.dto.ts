import {
  IsString,
  IsArray,
  IsEmail,
  IsOptional,
  IsObject,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BroadcastRecipientDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class BroadcastDto {
  @IsString()
  @IsOptional()
  templateKey?: string = 'admin_broadcast';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BroadcastRecipientDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  recipients: BroadcastRecipientDto[];

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
