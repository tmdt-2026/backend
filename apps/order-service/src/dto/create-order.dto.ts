import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  product_variant_id: string;

  @IsString()
  @IsNotEmpty()
  product_name: string;

  @IsOptional()
  @IsString()
  variant_label?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  import_price: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  item_discount?: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsOptional()
  @IsString()
  promotion_id?: string;

  @IsEnum(['full', 'installment'])
  payment_type: 'full' | 'installment';

  @IsEnum(['cod', 'vnpay', 'momo', 'bank_transfer'])
  payment_method: 'cod' | 'vnpay' | 'momo' | 'bank_transfer';

  @IsString()
  @IsNotEmpty()
  shipping_name: string;

  @IsString()
  @IsNotEmpty()
  shipping_phone: string;

  @IsString()
  @IsNotEmpty()
  shipping_province: string;

  @IsString()
  @IsNotEmpty()
  shipping_district: string;

  @IsString()
  @IsNotEmpty()
  shipping_ward: string;

  @IsString()
  @IsNotEmpty()
  shipping_street: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}