import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ProductServiceUnavailableException } from '../common/exceptions/review.exceptions';

export const REVIEW_PRODUCT_RMQ_CLIENT = 'REVIEW_PRODUCT_RMQ_CLIENT';

export interface ProductRpcResponse {
  id: string;
  name: string;
}

export interface VariantSummaryRpcResponse {
  variantId: string;
  productId: string;
  isActive: boolean;
  stockQuantity: number;
}

@Injectable()
export class ProductRpc {
  private readonly logger = new Logger(ProductRpc.name);
  private readonly timeoutMs = parseInt(process.env.RPC_TIMEOUT_MS ?? '3000', 10);

  constructor(
    @Inject(REVIEW_PRODUCT_RMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async getProductById(productId: string): Promise<ProductRpcResponse | null> {
    try {
      const result = await firstValueFrom(
        this.client
          .send<{ success: boolean; data: ProductRpcResponse }>({ cmd: 'product.get-by-id' }, { id: productId })
          .pipe(timeout(this.timeoutMs)),
      );
      return result?.data ?? null;
    } catch (err: any) {
      this.logger.error(`Product RMQ error for ${productId}: ${err.message}`);
      throw new ProductServiceUnavailableException();
    }
  }

  async getVariantSummary(variantId: string): Promise<VariantSummaryRpcResponse | null> {
    try {
      const result = await firstValueFrom(
        this.client
          .send<{ success: boolean; data: VariantSummaryRpcResponse }>(
            { cmd: 'product.get-variant' },
            { variantId },
          )
          .pipe(timeout(this.timeoutMs)),
      );
      return result?.data ?? null;
    } catch (err: any) {
      this.logger.warn(`Product RMQ variant lookup failed for ${variantId}: ${err.message}`);
      return null;
    }
  }
}
