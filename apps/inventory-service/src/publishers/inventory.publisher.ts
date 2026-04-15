import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export const INVENTORY_RABBITMQ_CLIENT = 'INVENTORY_RABBITMQ_CLIENT';

@Injectable()
export class InventoryPublisher {
  private readonly logger = new Logger(InventoryPublisher.name);

  constructor(
    @Inject(INVENTORY_RABBITMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async publishStockLow(data: {
    productVariantId: string;
    currentQuantity: number;
    threshold: number;
    isOutOfStock: boolean;
  }): Promise<void> {
    await this.publish('inventory.stock_low', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  async publishStockUpdated(data: {
    productVariantId: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  }): Promise<void> {
    await this.publish('inventory.stock_updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  async publishReserveFailed(data: {
    orderId: string;
    reason: string;
    insufficientItems?: any[];
  }): Promise<void> {
    await this.publish('order.reserve_failed', data);
  }

  private async publish(pattern: string, data: any): Promise<void> {
    try {
      await this.client.emit(pattern, data).toPromise();
      this.logger.log(`Published: ${pattern}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish ${pattern}: ${error.message}`);
    }
  }
}
