import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

@Injectable()
export class UserPublisher {
  private readonly logger = new Logger(UserPublisher.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async publishUserRegistered(data: { userId: string; email: string; userName: string; loginUrl?: string }) {
    return this.publish('user.registered', data);
  }

  async publishPasswordReset(data: { userId: string; email: string; userName: string; resetUrl: string; expiresIn?: string }) {
    return this.publish('user.password_reset', data);
  }

  async publishAccountLocked(data: { userId: string; email: string; userName: string }) {
    return this.publish('user.account_locked', data);
  }

  private async publish(pattern: string, data: any): Promise<void> {
    try {
      await this.client.emit(pattern, data).toPromise();
      this.logger.log(`Published event: ${pattern}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${pattern}: ${error.message}`);
    }
  }
}
