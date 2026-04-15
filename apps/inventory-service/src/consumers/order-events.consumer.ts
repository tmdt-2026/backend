import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InventoryService, InsufficientStockException } from '../inventory/inventory.service';
import { InventoryPublisher } from '../publishers/inventory.publisher';

interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  createdAt: string;
  items: Array<{ productVariantId: string; quantity: number; price: number }>;
}

interface OrderConfirmedPayload {
  orderId: string;
  confirmedAt: string;
}

interface OrderCancelledPayload {
  orderId: string;
  cancelledAt: string;
  reason: string;
}

@Controller()
export class OrderEventsConsumer {
  private readonly logger = new Logger(OrderEventsConsumer.name);

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly publisher: InventoryPublisher,
  ) {}

  @EventPattern('order.created')
  async handleOrderCreated(@Payload() payload: OrderCreatedPayload): Promise<void> {
    this.logger.log(`Handling order.created: ${payload.orderId}`);
    try {
      // Quick bulk check first
      const check = await this.inventoryService.bulkCheck({ items: payload.items });
      if (!check.allAvailable) {
        this.logger.warn(`Reserve failed for order ${payload.orderId} — insufficient stock`);
        await this.publisher.publishReserveFailed({
          orderId: payload.orderId,
          reason: 'Insufficient stock',
          insufficientItems: check.items.filter((i) => !i.sufficient),
        });
        return;
      }
      await this.inventoryService.reserveStock(payload.orderId, payload.items);
      this.logger.log(`Reserved stock for order ${payload.orderId}`);
    } catch (err: any) {
      this.logger.error(`Failed to handle order.created ${payload.orderId}: ${err.message}`);
      if (err instanceof InsufficientStockException) {
        await this.publisher.publishReserveFailed({
          orderId: payload.orderId,
          reason: err.message,
        });
      }
      throw err;
    }
  }

  @EventPattern('order.confirmed')
  async handleOrderConfirmed(@Payload() payload: OrderConfirmedPayload): Promise<void> {
    this.logger.log(`Handling order.confirmed: ${payload.orderId}`);
    try {
      await this.inventoryService.deductStock(payload.orderId);
      this.logger.log(`Deducted stock for order ${payload.orderId}`);
    } catch (err: any) {
      this.logger.error(`Failed to handle order.confirmed ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() payload: OrderCancelledPayload): Promise<void> {
    this.logger.log(`Handling order.cancelled: ${payload.orderId}`);
    try {
      await this.inventoryService.releaseReserve(payload.orderId);
      this.logger.log(`Released reserve for order ${payload.orderId}`);
    } catch (err: any) {
      this.logger.error(`Failed to handle order.cancelled ${payload.orderId}: ${err.message}`);
      // Don't rethrow — idempotent, log and continue
    }
  }
}
