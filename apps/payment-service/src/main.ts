import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment-service.module';

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
  const logger = new Logger('PaymentService');

  const rabbitmqUrl = process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672';
  const paymentQueue = process.env.PAYMENT_RABBITMQ_QUEUE ?? process.env.PAYMENT_QUEUE ?? 'payment_queue';
  const port = parseInt(process.env.PAYMENT_SERVICE_PORT ?? process.env.PORT ?? '3007', 10);

  const app = await NestFactory.create(PaymentModule, {
    logger: ['log', 'error', 'warn'],
  });

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: paymentQueue,
      queueOptions: { durable: true },
      prefetchCount: parseInt(process.env.PAYMENT_RABBITMQ_PREFETCH ?? '10', 10),
      persistent: true,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);

  logger.log('========================================');
  logger.log('✅ Payment Service running');
  logger.log(`   HTTP  : http://localhost:${port}/api/payments`);
  logger.log(`   Queue : ${paymentQueue}`);
  logger.log('========================================');
}
bootstrap();
