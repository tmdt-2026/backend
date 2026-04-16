import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  IsOptional,
  IsObject,
  IsIn,
} from 'class-validator';

export class SendEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  templateKey: string;

  @IsEmail()
  toEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  toName?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['order', 'user', 'installment', 'payment', 'manual'])
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
