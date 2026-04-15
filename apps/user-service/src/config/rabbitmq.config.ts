import { registerAs } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
  transport: Transport.RMQ as const,
  options: {
    urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
    queue: process.env.USER_RABBITMQ_QUEUE ?? process.env.RABBITMQ_QUEUE ?? 'user_queue',
    prefetchCount: parseInt(process.env.USER_RABBITMQ_PREFETCH ?? process.env.RABBITMQ_PREFETCH ?? '10', 10),
    queueOptions: {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000,
        'x-max-length': 1000,
      },
    },
    socketOptions: {
      heartbeatInterval: 60000,
      reconnectTimeInSeconds: 5,
    },
  },
}));
