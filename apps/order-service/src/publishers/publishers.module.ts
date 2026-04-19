import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderPublisher, ORDER_INVENTORY_RABBITMQ_CLIENT, ORDER_NOTIFICATION_RABBITMQ_CLIENT } from './order.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ORDER_NOTIFICATION_RABBITMQ_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: process.env.NOTIFICATION_RABBITMQ_QUEUE ?? 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: ORDER_INVENTORY_RABBITMQ_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: process.env.INVENTORY_RABBITMQ_QUEUE ?? 'inventory_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [OrderPublisher],
  exports: [OrderPublisher, ClientsModule],
})
export class PublishersModule {}
