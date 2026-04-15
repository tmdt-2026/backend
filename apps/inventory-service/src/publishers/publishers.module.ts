import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InventoryPublisher, INVENTORY_RABBITMQ_CLIENT } from './inventory.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: INVENTORY_RABBITMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('rabbitmq.options.urls.0') ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [InventoryPublisher],
  exports: [InventoryPublisher],
})
export class PublishersModule {}
