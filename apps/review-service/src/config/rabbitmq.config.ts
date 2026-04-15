import { registerAs } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  transport: Transport.RMQ as const,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
    queue: process.env.REVIEW_RABBITMQ_QUEUE ?? 'review_queue',
    queueOptions: { durable: true },
  },
}));
