import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateModelDto } from './dto/create-model.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly productInclude = {
    variants: true,
    category: true,
    model: true,
    images: {
      orderBy: { sortOrder: 'asc' as const },
    },
  };

  private buildSearchTerm(keyword?: string) {
    const term = String(keyword ?? '').trim();
    return term.length ? term : null;
  }

  async createProduct(data: CreateProductDto) {
    try {
      const { variants, ...productData } = data;

      return await this.prisma.product.create({
        data: {
          ...productData, // productData lúc này đã chứa imgUrl
          variants: {
            create: variants.map((v) => ({
              color: v.color,
              ram: v.ram,
              storage: v.storage,
              importPrice: v.importPrice || 0, // Đảm bảo không bị undefined
              price: v.price || 0, // Đảm bảo không bị undefined
              stockQuantity: v.stockQuantity || 0,
              isActive: v.isActive ?? true,
            })),
          },
        },
      });
    } catch (error) {
      console.error('❌ Lỗi Prisma:', error);
      throw error;
    }
  }
  async findAllProducts(
    filter: { categoryId?: string; isActive?: boolean } = {},
  ) {
    // Log ra để kiểm tra filter gửi từ Frontend
    console.log('🔍 Fetching products with filter:', filter);

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(filter.categoryId && { categoryId: filter.categoryId }),
        ...(typeof filter.isActive === 'boolean' && { isActive: filter.isActive }),
      },
      include: this.productInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async searchProducts(filter: {
    keyword?: string;
    categoryId?: string;
    isActive?: boolean;
  } = {}) {
    const keyword = this.buildSearchTerm(filter.keyword);
    const numericStorage = keyword && Number.isFinite(Number(keyword)) ? Number(keyword) : null;

    if (!keyword) {
      return this.findAllProducts({
        categoryId: filter.categoryId,
        isActive: filter.isActive,
      });
    }

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(filter.categoryId && { categoryId: filter.categoryId }),
        ...(typeof filter.isActive === 'boolean' && { isActive: filter.isActive }),
        OR: [
          { name: { contains: keyword } },
          { description: { contains: keyword } },
          { category: { name: { contains: keyword } } },
          { model: { modelName: { contains: keyword } } },
          {
            variants: {
              some: {
                OR: [
                  { color: { contains: keyword } },
                  ...(numericStorage !== null ? [{ storage: numericStorage }] : []),
                ],
              },
            },
          },
        ],
      },
      include: this.productInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
  async findProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { where: { deletedAt: null } },
        category: true,
        model: true,
        images: {
          orderBy: { sortOrder: 'asc' as const },
        },
      },
    });

    if (!product || product.deletedAt) {
      throw new NotFoundException('Không tìm thấy sản phẩm hoặc đã bị xóa');
    }
    return product;
  }

  async updateProduct(id: string, data: UpdateProductDto) {
    // Lưu ý: Cột img_url trong SQL phải khớp với imgUrl trong DTO qua @map
    return this.prisma.product.update({
      where: { id },
      data,
      include: { variants: true, category: true },
    });
  }
  async softDeleteProduct(id: string) {
    const cleanId = String(id).trim();

    // Dùng transaction để xóa cả sản phẩm và biến thể cùng lúc
    return await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật biến thể
      await tx.productVariant.updateMany({
        where: { productId: cleanId },
        data: { deletedAt: new Date() },
      });

      // 2. Cập nhật sản phẩm
      return await tx.product.update({
        where: { id: cleanId },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });
    });
  }
  // ==================== VARIANT ====================
  async createVariant(productId: string, data: CreateProductDto['variants'][number]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, deletedAt: true },
    });

    if (!product || product.deletedAt) {
      throw new NotFoundException('Không tìm thấy sản phẩm để tạo biến thể');
    }

    return this.prisma.productVariant.create({
      data: {
        productId,
        color: data.color,
        ram: data.ram,
        storage: data.storage,
        importPrice: data.importPrice,
        originalPrice: data.originalPrice,
        price: data.price,
        stockQuantity: data.stockQuantity,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findVariantsByProductId(productId: string) {
    return this.prisma.productVariant.findMany({
      where: {
        productId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVariantById(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            category: true,
            model: true,
          },
        },
      },
    });

    if (!variant || variant.deletedAt) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm');
    }

    return variant;
  }

  async softDeleteVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, deletedAt: true },
    });

    if (!variant || variant.deletedAt) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm');
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  async updateVariant(variantId: string, data: UpdateVariantDto) {
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data,
    });
  }

  async updateVariantPrice(
    variantId: string,
    newPrice: number,
    changedBy: string,
    reason?: string,
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant)
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm');

    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật giá mới
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { price: newPrice },
      });

      // 2. Ghi lịch sử (Khớp với bảng PRICE_HISTORIES)
      await tx.priceHistory.create({
        data: {
          productVariantId: variantId,
          changedBy: changedBy, // Trong SQL là CHAR(36), đảm bảo truyền đúng UUID
          oldPrice: variant.price,
          newPrice: newPrice,
          reason: reason || 'Cập nhật giá thủ công',
        },
      });

      return updated;
    });
  }

  async getStockByVariant(variantId: string) {
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { stockQuantity: true, isActive: true },
    });
  }
  // ==================== CATEGORY ====================
  async createCategory(data: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        parentId: data.parentId || null,
        sortOrder: data.sortOrder || 0,
        isActive: true,
      },
    });
  }

  async findAllCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async searchCategories(keyword?: string) {
    const term = this.buildSearchTerm(keyword);

    if (!term) {
      return this.findAllCategories();
    }

    return this.prisma.category.findMany({
      where: {
        OR: [
          { name: { contains: term } },
          { slug: { contains: term } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
  // ==================== MODEL ====================
  async createModel(data: CreateModelDto) {
    return this.prisma.model.create({
      data: {
        id: data.id,
        modelName: data.modelName,
        modelNumber: data.modelNumber,
        brand: data.brand,
        cpu: data.cpu,
        screenSize: data.screenSize,
        operaSystem: data.operaSystem,
        isActive: true,
      },
    });
  }

  async findAllModels() {
    return this.prisma.model.findMany({
      where: { deletedAt: null },
      orderBy: { modelName: 'asc' },
    });
  }

  async searchModels(keyword?: string) {
    const term = this.buildSearchTerm(keyword);

    if (!term) {
      return this.findAllModels();
    }

    return this.prisma.model.findMany({
      where: {
        deletedAt: null,
        OR: [
          { modelName: { contains: term } },
          { modelNumber: { contains: term } },
          { brand: { contains: term } },
          { cpu: { contains: term } },
          { operaSystem: { contains: term } },
        ],
      },
      orderBy: { modelName: 'asc' },
    });
  }

  async searchVariants(keyword?: string, productId?: string) {
    const term = this.buildSearchTerm(keyword);

    if (!term) {
      return [];
    }

    const numericStorage = Number.isFinite(Number(term)) ? Number(term) : null;

    return this.prisma.productVariant.findMany({
      where: {
        deletedAt: null,
        ...(productId && { productId }),
        OR: [
          { color: { contains: term } },
          { product: { name: { contains: term } } },
          { product: { category: { name: { contains: term } } } },
          { product: { model: { modelName: { contains: term } } } },
          ...(numericStorage !== null ? [{ storage: numericStorage }] : []),
        ],
      },
      include: {
        product: {
          include: {
            category: true,
            model: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
