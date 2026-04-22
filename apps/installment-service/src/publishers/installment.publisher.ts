import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export const INSTALLMENT_RABBITMQ_CLIENT = 'INSTALLMENT_RABBITMQ_CLIENT';

@Injectable()
export class InstallmentPublisher {
  private readonly logger = new Logger(InstallmentPublisher.name);

  constructor(@Inject(INSTALLMENT_RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  async publishInstallmentApproved(payload: Record<string, unknown>) {
    await this.publish('installment.approved', payload);
  }

  async publishInstallmentRejected(payload: Record<string, unknown>) {
    await this.publish('installment.rejected', payload);
  }

  private async publish(pattern: string, payload: Record<string, unknown>) {
    try {
      await this.client.emit(pattern, payload).toPromise();
      this.logger.log(`Published event: ${pattern}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish ${pattern}: ${error.message}`);
    }
  }
}
