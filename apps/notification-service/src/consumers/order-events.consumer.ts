import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';

interface OrderConfirmedPayload {
  orderId: string;
  orderCode: string;
  userId: string;
  userEmail: string;
  userName: string;
  orderDate: string;
  items: Array<{ name: string; variant: string; quantity: number; price: string }>;
  subtotal: string;
  discount?: string;
  total: string;
  shippingAddress: string;
  paymentMethod: string;
  trackingUrl: string;
}

interface OrderProcessingPayload {
  orderId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  trackingUrl: string;
}

interface OrderShippedPayload {
  orderId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  estimatedDate: string;
  trackingUrl: string;
  shippingAddress: string;
}

interface OrderCompletedPayload {
  orderId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  reviewUrl: string;
}

interface OrderCancelledPayload {
  orderId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  cancelReason: string;
  refundInfo?: string;
  supportUrl: string;
}

@Controller()
export class OrderEventsConsumer {
  private readonly logger = new Logger(OrderEventsConsumer.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('order.confirmed')
  async handleOrderConfirmed(@Payload() payload: OrderConfirmedPayload): Promise<void> {
    this.logger.log(`Handling order.confirmed: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'order_confirmed',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'order',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed order.confirmed ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('order.processing')
  async handleOrderProcessing(@Payload() payload: OrderProcessingPayload): Promise<void> {
    this.logger.log(`Handling order.processing: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'order_processing',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'order',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed order.processing ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('order.shipped')
  async handleOrderShipped(@Payload() payload: OrderShippedPayload): Promise<void> {
    this.logger.log(`Handling order.shipped: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'order_shipped',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'order',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed order.shipped ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('order.completed')
  async handleOrderCompleted(@Payload() payload: OrderCompletedPayload): Promise<void> {
    this.logger.log(`Handling order.completed: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'order_completed',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'order',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed order.completed ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() payload: OrderCancelledPayload): Promise<void> {
    this.logger.log(`Handling order.cancelled: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'order_cancelled',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'order',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed order.cancelled ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }
}
