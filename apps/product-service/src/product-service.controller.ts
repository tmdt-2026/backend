import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ProductService } from './product-service.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateModelDto } from './dto/create-model.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('categories')
  async getCategories() {
    console.log('📂 Đang lấy danh sách danh mục...');
    return this.productService.findAllCategories();
  }

  @Get('models')
  async getModels() {
    console.log('📂 Đang lấy danh sách model...');
    return this.productService.findAllModels();
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.productService.createCategory(dto);
  }

  @Post('models')
  async createModel(@Body() dto: CreateModelDto) {
    return this.productService.createModel(dto);
  }

  @Patch('variants/:variantId')
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productService.updateVariant(variantId, dto);
  }

  @Patch('variants/:variantId/price')
  async updatePrice(
    @Param('variantId') variantId: string,
    @Body() body: { price: number; reason?: string; changedBy: string },
  ) {
    return this.productService.updateVariantPrice(
      variantId,
      body.price,
      body.changedBy,
      body.reason,
    );
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productService.createProduct(dto);
  }

  @Get()
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.productService.findAllProducts({
      categoryId,
      isActive: isActive === 'true',
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    console.log('🔍 Đang tìm sản phẩm theo ID:', id);
    return this.productService.findProductById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(id, dto);
  }

  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    console.log('🗑️  Yêu cầu xóa sản phẩm ID:', id);
    return this.productService.softDeleteProduct(id);
  }
}
