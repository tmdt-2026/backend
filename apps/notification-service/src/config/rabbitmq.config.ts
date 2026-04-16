import { registerAs } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  transport: Transport.RMQ as const,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
    queue: process.env.NOTIFICATION_RABBITMQ_QUEUE ?? 'notification_queue',
    prefetchCount: parseInt(process.env.NOTIFICATION_RABBITMQ_PREFETCH ?? '10', 10),
    queueOptions: { durable: true },
  },
}));
