import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { OrderServiceUnavailableException } from '../common/exceptions/review.exceptions';

export const REVIEW_ORDER_RMQ_CLIENT = 'REVIEW_ORDER_RMQ_CLIENT';

export interface OrderRpcResponse {
  id: string;
  userId: string;
  status: string;
  items: Array<{
    productVariantId: string;
    productId: string;
    productName: string;
  }>;
}

@Injectable()
export class OrderRpc {
  private readonly logger = new Logger(OrderRpc.name);
  private readonly timeoutMs = parseInt(process.env.RPC_TIMEOUT_MS ?? '3000', 10);

  constructor(
    @Inject(REVIEW_ORDER_RMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async getOrderById(orderId: string): Promise<OrderRpcResponse | null> {
    try {
      const result = await firstValueFrom(
        this.client
          .send<OrderRpcResponse | null>({ cmd: 'order.get-by-id' }, { id: orderId })
          .pipe(timeout(this.timeoutMs)),
      );
      return result ?? null;
    } catch (err: any) {
      this.logger.error(`Order RMQ error for ${orderId}: ${err.message}`);
      throw new OrderServiceUnavailableException();
    }
  }
}
