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
import { CreateVariantDto } from './dto/create-product.dto';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('categories')
  @Public()
  async getCategories() {
    console.log('📂 Đang lấy danh sách danh mục...');
    return this.productService.findAllCategories();
  }

  @Get('models')
  @Public()
  async getModels() {
    console.log('📂 Đang lấy danh sách model...');
    return this.productService.findAllModels();
  }

  @Post('categories')
  @Roles('admin')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.productService.createCategory(dto);
  }

  @Post('models')
  @Roles('admin')
  async createModel(@Body() dto: CreateModelDto) {
    return this.productService.createModel(dto);
  }

  @Patch('variants/:variantId')
  @Roles('admin')
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productService.updateVariant(variantId, dto);
  }

  @Get('variants/:variantId')
  @Public()
  async getVariantById(@Param('variantId') variantId: string) {
    return this.productService.findVariantById(variantId);
  }

  @Delete('variants/:variantId')
  @Roles('admin')
  async softDeleteVariant(@Param('variantId') variantId: string) {
    return this.productService.softDeleteVariant(variantId);
  }

  @Patch('variants/:variantId/price')
  @Roles('admin')
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
  @Roles('admin')
  async create(@Body() dto: CreateProductDto) {
    return this.productService.createProduct(dto);
  }

  @Post(':id/variants')
  @Roles('admin')
  async createVariant(
    @Param('id') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productService.createVariant(productId, dto);
  }

  @Get(':id/variants')
  @Public()
  async getProductVariants(@Param('id') productId: string) {
    return this.productService.findVariantsByProductId(productId);
  }

  @Get()
  @Public()
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.productService.findAllProducts({
      categoryId,
      isActive: isActive === 'true',
    });
  }

  @Get('category/:categoryId')
  @Public()
  async findByCategory(@Param('categoryId') categoryId: string) {
    return this.productService.findAllProducts({ categoryId });
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    console.log('🔍 Đang tìm sản phẩm theo ID:', id);
    return this.productService.findProductById(id);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async softDelete(@Param('id') id: string) {
    console.log('🗑️  Yêu cầu xóa sản phẩm ID:', id);
    return this.productService.softDeleteProduct(id);
  }
}
