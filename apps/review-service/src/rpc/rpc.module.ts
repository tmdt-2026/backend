import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderRpc, REVIEW_ORDER_RMQ_CLIENT } from './order.rpc';
import { ProductRpc, REVIEW_PRODUCT_RMQ_CLIENT } from './product.rpc';
import { UserRpc, REVIEW_USER_RMQ_CLIENT } from './user.rpc';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: REVIEW_USER_RMQ_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: process.env.USER_RABBITMQ_QUEUE ?? 'user_queue',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: REVIEW_PRODUCT_RMQ_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: process.env.PRODUCT_RABBITMQ_QUEUE ?? 'product_queue',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: REVIEW_ORDER_RMQ_CLIENT,
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672'],
            queue: process.env.ORDER_RABBITMQ_QUEUE ?? 'order_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [UserRpc, ProductRpc, OrderRpc],
  exports: [UserRpc, ProductRpc, OrderRpc],
})
export class RpcModule {}
