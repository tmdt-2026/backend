import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export const ORDER_NOTIFICATION_RABBITMQ_CLIENT = 'ORDER_NOTIFICATION_RABBITMQ_CLIENT';
export const ORDER_INVENTORY_RABBITMQ_CLIENT = 'ORDER_INVENTORY_RABBITMQ_CLIENT';

@Injectable()
export class OrderPublisher {
  private readonly logger = new Logger(OrderPublisher.name);

  constructor(
    @Inject(ORDER_NOTIFICATION_RABBITMQ_CLIENT) private readonly notificationClient: ClientProxy,
    @Inject(ORDER_INVENTORY_RABBITMQ_CLIENT) private readonly inventoryClient: ClientProxy,
  ) {}

  async publishOrderCreated(data: {
    orderId: string;
    userId: string;
    createdAt: string;
    items: Array<{ productVariantId: string; quantity: number; price: number }>;
  }): Promise<void> {
    await this.publish(this.inventoryClient, 'order.created', data);
  }

  async publishOrderConfirmed(data: Record<string, unknown>): Promise<void> {
    await Promise.all([
      this.publish(this.notificationClient, 'order.confirmed', data),
      this.publish(this.inventoryClient, 'order.confirmed', {
        orderId: data.orderId,
        confirmedAt: data.confirmedAt,
      }),
    ]);
  }

  async publishOrderProcessing(data: Record<string, unknown>): Promise<void> {
    await this.publish(this.notificationClient, 'order.processing', data);
  }

  async publishOrderShipped(data: Record<string, unknown>): Promise<void> {
    await this.publish(this.notificationClient, 'order.shipped', data);
  }

  async publishOrderCompleted(data: Record<string, unknown>): Promise<void> {
    await this.publish(this.notificationClient, 'order.completed', data);
  }

  async publishOrderCancelled(data: Record<string, unknown>): Promise<void> {
    await Promise.all([
      this.publish(this.notificationClient, 'order.cancelled', data),
      this.publish(this.inventoryClient, 'order.cancelled', {
        orderId: data.orderId,
        cancelledAt: data.cancelledAt,
        reason: data.cancelReason,
      }),
    ]);
  }

  private async publish(client: ClientProxy, pattern: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await client.emit(pattern, payload).toPromise();
      this.logger.log(`Published event: ${pattern}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish ${pattern}: ${error.message}`);
    }
  }
}