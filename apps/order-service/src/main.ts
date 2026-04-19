  import { NestFactory } from '@nestjs/core';
  import { OrderServiceModule } from './order-service.module';
  import { Logger, ValidationPipe } from '@nestjs/common';
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
    const logger = new Logger('OrderService');

    const rabbitmqUrl =
      process.env.RABBITMQ_URL ?? 'amqp://tmdt:tmdt2026@rabbitmq:5672';

    const orderQueue =
      process.env.ORDER_QUEUE ??
      process.env.ORDER_RABBITMQ_QUEUE ??
      'order_queue';

    const port =
      Number(process.env.ORDER_SERVICE_PORT ?? process.env.PORT ?? 3005);

    const app = await NestFactory.create(OrderServiceModule);

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: orderQueue,
        queueOptions: { durable: true },
        prefetchCount: Number(process.env.ORDER_RABBITMQ_PREFETCH ?? 10),
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

    await app.startAllMicroservices();
    await app.listen(port);

    logger.log(`========================================`);
    logger.log(`✅ Order Service running`);
    logger.log(`   HTTP  : http://localhost:${port}`);
    logger.log(`   Queue : ${orderQueue}`);
    logger.log(`========================================`);
  }

  bootstrap().catch((err) => {
    console.error('❌ Failed to start Order Service:', err);
    process.exit(1);
  });