import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export const PAYMENT_RABBITMQ_CLIENT = 'PAYMENT_RABBITMQ_CLIENT';

@Injectable()
export class PaymentPublisher {
  private readonly logger = new Logger(PaymentPublisher.name);

  constructor(@Inject(PAYMENT_RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  async publishPaymentSuccess(data: Record<string, unknown>): Promise<void> {
    await this.publish('payment.success', data);
  }

  async publishPaymentFailed(data: Record<string, unknown>): Promise<void> {
    await this.publish('payment.failed', data);
  }

  private async publish(pattern: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.client.emit(pattern, payload).toPromise();
      this.logger.log(`Published event: ${pattern}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish ${pattern}: ${error.message}`);
    }
  }
}