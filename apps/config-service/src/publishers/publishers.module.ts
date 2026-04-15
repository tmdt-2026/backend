import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigPublisher, CONFIG_RABBITMQ_CLIENT } from './config.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: CONFIG_RABBITMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL') ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [ConfigPublisher],
  exports: [ConfigPublisher],
})
export class PublishersModule {}
