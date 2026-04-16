import { IsObject, IsOptional } from 'class-validator';

export class PreviewTemplateDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
