import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';

interface PaymentSuccessPayload {
  orderId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  amount: string;
  paymentMethod: string;
  transactionCode: string;
  paidAt: string;
  receiptUrl: string;
}

interface PaymentFailedPayload {
  orderId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  amount: string;
  failReason: string;
  retryUrl: string;
}

@Controller()
export class PaymentEventsConsumer {
  private readonly logger = new Logger(PaymentEventsConsumer.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('payment.success')
  async handlePaymentSuccess(@Payload() payload: PaymentSuccessPayload): Promise<void> {
    this.logger.log(`Handling payment.success for order: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'payment_success',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'payment',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed payment.success ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(@Payload() payload: PaymentFailedPayload): Promise<void> {
    this.logger.log(`Handling payment.failed for order: ${payload.orderId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'payment_failed',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'payment',
        referenceId: payload.orderId,
      });
    } catch (err: any) {
      this.logger.error(`Failed payment.failed ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }
}
