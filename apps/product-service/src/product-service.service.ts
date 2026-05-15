import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateModelDto } from './dto/update-model.dto';

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

  private buildVariantKey(spec: { color?: string | null; ram?: number | null; storage?: number | null }) {
    const normalizedColor = spec.color?.trim().toLowerCase() || '';
    const normalizedRam = spec.ram ?? '';
    const normalizedStorage = spec.storage ?? '';
    return `${normalizedColor}|${normalizedRam}|${normalizedStorage}`;
  }

  private async ensureCategoryAvailable(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (!category) {
      throw new BadRequestException('Danh mục không tồn tại');
    }
    if (!category.isActive) {
      throw new BadRequestException('Danh mục đang bị ẩn, không thể gán cho sản phẩm');
    }
  }

  private async ensureModelAvailable(modelId?: string) {
    if (!modelId) return;
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!model || model.deletedAt) {
      throw new BadRequestException('Model không tồn tại hoặc đã bị xóa');
    }
    if (!model.isActive) {
      throw new BadRequestException('Model đang bị ẩn, không thể gán cho sản phẩm');
    }
  }

  private async assertNoDuplicateVariant(
    productId: string,
    spec: { color?: string | null; ram?: number | null; storage?: number | null },
    excludeVariantId?: string,
  ) {
    const duplicate = await this.prisma.productVariant.findFirst({
      where: {
        productId,
        deletedAt: null,
        color: spec.color ?? null,
        ram: spec.ram ?? null,
        storage: spec.storage ?? null,
        ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new BadRequestException('Biến thể với màu/RAM/bộ nhớ này đã tồn tại');
    }
  }

  async createProduct(data: CreateProductDto) {
    try {
      const { variants, ...productData } = data;
      await this.ensureCategoryAvailable(productData.categoryId);
      await this.ensureModelAvailable(productData.modelId);

      // Reject duplicated variants in a single create request.
      const payloadKeys = new Set<string>();
      for (const variant of variants) {
        const variantKey = this.buildVariantKey(variant);
        if (payloadKeys.has(variantKey)) {
          throw new BadRequestException('Danh sách biến thể gửi lên đang bị trùng');
        }
        payloadKeys.add(variantKey);
      }

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
    if (data.categoryId) {
      await this.ensureCategoryAvailable(data.categoryId);
    }
    if (data.modelId !== undefined) {
      await this.ensureModelAvailable(data.modelId);
    }

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
    await this.assertNoDuplicateVariant(productId, {
      color: data.color,
      ram: data.ram,
      storage: data.storage,
    });

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
    const current = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        color: true,
        ram: true,
        storage: true,
        deletedAt: true,
      },
    });

    if (!current || current.deletedAt) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm');
    }

    const nextSpec = {
      color: data.color ?? current.color,
      ram: data.ram ?? current.ram,
      storage: data.storage ?? current.storage,
    };

    await this.assertNoDuplicateVariant(current.productId, nextSpec, current.id);

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

  /** RPC / đặt hàng: tóm tắt variant kèm productId */
  async getVariantSummaryForOrder(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        stockQuantity: true,
        isActive: true,
        deletedAt: true,
      },
    });
    if (!variant || variant.deletedAt) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm');
    }
    return {
      variantId: variant.id,
      productId: variant.productId,
      stockQuantity: variant.stockQuantity,
      isActive: variant.isActive,
    };
  }

  /**
   * Trừ tồn kho biến thể (stockQuantity) khi đặt hàng — atomic theo từng dòng.
   */
  async decrementStocksForOrder(items: Array<{ variantId: string; quantity: number }>) {
    if (!items?.length) return;
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new BadRequestException(`Số lượng không hợp lệ cho biến thể ${item.variantId}`);
        }
        const res = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            deletedAt: null,
            stockQuantity: { gte: qty },
          },
          data: { stockQuantity: { decrement: qty } },
        });
        if (res.count !== 1) {
          throw new BadRequestException(
            `Không đủ tồn kho cho biến thể ${item.variantId} (yêu cầu ${qty})`,
          );
        }
      }
    });
  }

  /**
   * Hoàn tồn kho khi hủy đơn / xóa đơn (best-effort nếu variant đã bị xóa mềm).
   */
  async incrementStocksForOrder(items: Array<{ variantId: string; quantity: number }>) {
    if (!items?.length) return;
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        await tx.productVariant.updateMany({
          where: { id: item.variantId, deletedAt: null },
          data: { stockQuantity: { increment: qty } },
        });
      }
    });
  }

  // ==================== CATEGORY ====================
  async createCategory(data: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        slug: data.slug,
        parentId: data.parentId || null,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive ?? true,
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
        ...(data.id ? { id: data.id } : {}),
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

  async findAllModels(includeDeleted = false) {
    return this.prisma.model.findMany({
      ...(includeDeleted ? {} : { where: { deletedAt: null } }),
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

  async updateCategory(id: string, data: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    if (data.parentId === id) {
      throw new BadRequestException('Danh mục không thể là cha của chính nó');
    }

    const nextParentId =
      data.parentId !== undefined
        ? data.parentId || null
        : existing.parentId;

    if (nextParentId) {
      const visited = new Set<string>([id]);
      let cursor: string | null = nextParentId;
      while (cursor) {
        if (visited.has(cursor)) {
          throw new BadRequestException('Danh mục cha tạo thành vòng lặp');
        }
        visited.add(cursor);
        const node = await this.prisma.category.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        if (!node) {
          throw new BadRequestException('Danh mục cha không tồn tại');
        }
        cursor = node.parentId;
      }

      const parent = await this.prisma.category.findUnique({
        where: { id: nextParentId },
      });
      if (!parent) {
        throw new BadRequestException('Danh mục cha không tồn tại');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.parentId !== undefined ? { parentId: nextParentId } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    const [childrenCount, productsCount] = await this.prisma.$transaction([
      this.prisma.category.count({ where: { parentId: id } }),
      // Keep referential integrity: categories cannot be hard-deleted
      // while any product row still references them (including soft-deleted products).
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);

    if (childrenCount > 0) {
      throw new BadRequestException(
        'Danh mục đang có danh mục con, không thể xóa',
      );
    }

    if (productsCount > 0) {
      throw new BadRequestException(
        'Danh mục đang có sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước',
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { success: true, message: 'Đã xóa danh mục' };
  }

  async updateModel(id: string, data: UpdateModelDto) {
    const existing = await this.prisma.model.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy model');
    }

    const nextIsActive = data.isActive;
    const nextDeletedAt =
      nextIsActive === undefined
        ? undefined
        : nextIsActive
          ? null
          : existing.deletedAt ?? new Date();

    return this.prisma.model.update({
      where: { id },
      data: {
        ...(data.modelName !== undefined ? { modelName: data.modelName } : {}),
        ...(data.modelNumber !== undefined
          ? { modelNumber: data.modelNumber }
          : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        ...(data.cpu !== undefined ? { cpu: data.cpu } : {}),
        ...(data.screenSize !== undefined ? { screenSize: data.screenSize } : {}),
        ...(data.operaSystem !== undefined
          ? { operaSystem: data.operaSystem }
          : {}),
        ...(nextIsActive !== undefined ? { isActive: nextIsActive } : {}),
        ...(nextDeletedAt !== undefined ? { deletedAt: nextDeletedAt } : {}),
      },
    });
  }

  async softDeleteModel(id: string) {
    const existing = await this.prisma.model.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy model');
    }

    return this.prisma.model.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
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

  async findPriceHistory(limit = 200) {
    return this.prisma.priceHistory.findMany({
      take: limit,
      orderBy: { changedAt: 'desc' },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}
