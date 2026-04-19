import { NestFactory } from '@nestjs/core';
import { ProductServiceModule } from './product-service.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import helmet from 'helmet';

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
  const logger = new Logger('ProductService');

  const rabbitmqUrl =
    process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672';

  const productQueue =
    process.env.PRODUCT_QUEUE ?? 'product_queue';

  const port =
    process.env.PRODUCT_SERVICE_PORT ?? process.env.PORT ?? 3004;

  const app = await NestFactory.create(ProductServiceModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: productQueue,
      queueOptions: { durable: true },
      prefetchCount: Number(process.env.PRODUCT_RABBITMQ_PREFETCH ?? 10),
      persistent: true,
    },
  });

  app.use(helmet());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.startAllMicroservices();
  await app.listen(port);

  logger.log(`========================================`);
  logger.log(`✅ Product Service running`);
  logger.log(`   HTTP  : http://localhost:${port}`);
  logger.log(`   Queue : ${productQueue}`);
  logger.log(`========================================`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start Product Service:', err);
  process.exit(1);
});
