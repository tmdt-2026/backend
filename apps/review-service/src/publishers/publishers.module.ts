import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReviewPublisher, REVIEW_RABBITMQ_CLIENT } from './review.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: REVIEW_RABBITMQ_CLIENT,
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
  providers: [ReviewPublisher],
  exports: [ReviewPublisher],
})
export class PublishersModule {}
