import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { OrderServiceModule } from './order-service.module';

const rootEnvPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
].find((path) => existsSync(path));

if (rootEnvPath) {
  loadEnv({ path: rootEnvPath });
}

async function bootstrap() {
  const logger = new Logger('OrderService');

  const rabbitmqUrl = process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672';
  const orderQueue = process.env.ORDER_RABBITMQ_QUEUE ?? process.env.ORDER_QUEUE ?? 'order_queue';
  const port = parseInt(process.env.ORDER_SERVICE_PORT ?? process.env.PORT ?? '3005', 10);

  const app = await NestFactory.create(OrderServiceModule, {
    logger: ['log', 'error', 'warn'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: orderQueue,
      queueOptions: { durable: true },
      prefetchCount: parseInt(process.env.ORDER_RABBITMQ_PREFETCH ?? '10', 10),
      persistent: true,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);

  logger.log('========================================');
  logger.log('✅ Order Service running');
  logger.log(`   HTTP  : http://localhost:${port}/api/v1/orders`);
  logger.log(`   Queue : ${orderQueue}`);
  logger.log('========================================');
}
bootstrap();