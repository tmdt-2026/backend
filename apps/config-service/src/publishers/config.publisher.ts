import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export const CONFIG_RABBITMQ_CLIENT = 'CONFIG_RABBITMQ_CLIENT';

@Injectable()
export class ConfigPublisher {
  private readonly logger = new Logger(ConfigPublisher.name);

  constructor(@Inject(CONFIG_RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  async publish(pattern: string, payload: Record<string, unknown>): Promise<void> {
    try {
      this.client.emit(pattern, payload);
    } catch (err) {
      this.logger.error(`Failed to publish ${pattern}:`, err);
    }
  }
}
