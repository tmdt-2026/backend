import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { INSTALLMENT_RABBITMQ_CLIENT, InstallmentPublisher } from './installment.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: INSTALLMENT_RABBITMQ_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: process.env.NOTIFICATION_RABBITMQ_QUEUE ?? 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [InstallmentPublisher],
  exports: [InstallmentPublisher],
})
export class PublishersModule {}
