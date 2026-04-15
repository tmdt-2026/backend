import { IsString, IsArray, IsUUID } from 'class-validator';

export class ReorderBannersDto {
  @IsString()
  position: string;

  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
