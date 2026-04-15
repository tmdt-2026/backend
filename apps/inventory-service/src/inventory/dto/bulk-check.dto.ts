import { IsArray, IsInt, IsUUID, Min, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCheckItemDto {
  @IsUUID()
  productVariantId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

export class BulkCheckDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCheckItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: BulkCheckItemDto[];
}
