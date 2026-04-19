import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

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
  const logger = new Logger('PromotionService');
  const rabbitmqUrl = process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672';
  const promotionQueue = process.env.PROMOTION_RABBITMQ_QUEUE ?? process.env.PROMOTION_QUEUE ?? 'promotion_queue';
  const port = parseInt(process.env.PROMOTION_SERVICE_PORT ?? process.env.PORT ?? '3006', 10);

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: promotionQueue,
      queueOptions: { durable: true },
      socketOptions: {
        heartbeatInterval: 60000,
        reconnectTimeInSeconds: 5,
      },
      prefetchCount: parseInt(process.env.PROMOTION_RABBITMQ_PREFETCH ?? '10', 10),
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);

  logger.log('========================================');
  logger.log('✅ Promotion Service running');
  logger.log(`   HTTP : http://localhost:${port}/api/v1`);
  logger.log(`   Queue: ${promotionQueue}`);
  logger.log('========================================');
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start Promotion Service:', err);
  process.exit(1);
});
