import { registerAs } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  transport: Transport.RMQ as const,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
    queue: process.env.INVENTORY_RABBITMQ_QUEUE ?? 'inventory_queue',
    queueOptions: { durable: true },
  },
}));
