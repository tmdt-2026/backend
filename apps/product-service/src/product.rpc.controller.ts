import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductService } from './product-service.service';

@Controller()
export class ProductRpcController {
  private readonly logger = new Logger(ProductRpcController.name);

  constructor(private readonly productService: ProductService) {}

  @MessagePattern({ cmd: 'ping' })
  ping() {
    return {
      success: true,
      service: 'product-service',
      transport: 'rmq',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Lấy thông tin sản phẩm theo ID
   * cmd: product.get-by-id
   */
  @MessagePattern({ cmd: 'product.get-by-id' })
  async getById(@Payload() payload: { id: string }) {
    try {
      const product = await this.productService.findProductById(payload.id);
      return { success: true, data: product };
    } catch (error) {
      this.logger.error(`product.get-by-id error:`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách sản phẩm (có filter)
   * cmd: product.find-all
   */
  @MessagePattern({ cmd: 'product.find-all' })
  async findAll(
    @Payload() payload: { categoryId?: string; isActive?: boolean } = {},
  ) {
    try {
      const products = await this.productService.findAllProducts(payload);
      return { success: true, data: products };
    } catch (error) {
      this.logger.error(`product.find-all error:`, error);
      throw error;
    }
  }

  /**
   * Lấy thông tin variant (cho order-service, inventory-service)
   * cmd: product.get-variant
   */
  @MessagePattern({ cmd: 'product.get-variant' })
  async getVariant(@Payload() payload: { variantId: string }) {
    try {
      const variant = await this.productService.getStockByVariant(payload.variantId);
      return { success: true, data: variant };
    } catch (error) {
      this.logger.error(`product.get-variant error:`, error);
      throw error;
    }
  }

  /**
   * Kiểm tra sản phẩm có active không (dùng trước khi tạo order)
   * cmd: product.check-active
   */
  @MessagePattern({ cmd: 'product.check-active' })
  async checkActive(@Payload() payload: { productId: string }) {
    try {
      const product = await this.productService.findProductById(payload.productId);
      return {
        success: true,
        data: {
          productId: payload.productId,
          isActive: product.isActive,
          exists: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: { productId: payload.productId, isActive: false, exists: false },
      };
    }
  }

  /**
   * Cập nhật giá variant qua RabbitMQ
   * cmd: product.update-variant-price
   */
  @MessagePattern({ cmd: 'product.update-variant-price' })
  async updateVariantPrice(
    @Payload()
    payload: {
      variantId: string;
      price: number;
      changedBy: string;
      reason?: string;
    },
  ) {
    try {
      const updated = await this.productService.updateVariantPrice(
        payload.variantId,
        payload.price,
        payload.changedBy,
        payload.reason,
      );
      return { success: true, data: updated };
    } catch (error) {
      this.logger.error(`product.update-variant-price error:`, error);
      throw error;
    }
  }
}
