import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';

const rootEnvPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
].find((path) => existsSync(path));

if (rootEnvPath) {
  loadEnv({ path: rootEnvPath });
}

function makeProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    onError: (_err, _req, res: any) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: 'BAD_GATEWAY',
              message: 'Service unavailable',
              statusCode: 502,
            },
          }),
        );
      }
    },
  });
}

function mountProxy(expressApp: any, mountPath: string, target: string) {
  expressApp.use(
    mountPath,
    (req: any, _res: any, next: any) => {
      const suffix = req.url === '/' ? '' : req.url;
      req.url = `${mountPath}${suffix}`;
      next();
    },
    makeProxy(target),
  );
}

async function bootstrap() {
  const logger = new Logger('APIGateway');
  const port = parseInt(process.env.TMDT_PORT ?? process.env.PORT ?? '3000', 10);

  const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
  const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL ?? 'http://localhost:3004';
  const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:3005';
  const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:3003';
  const REVIEW_SERVICE_URL    = process.env.REVIEW_SERVICE_URL    ?? 'http://localhost:3002';
  const CONFIG_SERVICE_URL    = process.env.CONFIG_SERVICE_URL    ?? 'http://localhost:3011';
  const PROMOTION_SERVICE_URL     = process.env.PROMOTION_SERVICE_URL     ?? 'http://localhost:3006';
  const PAYMENT_SERVICE_URL       = process.env.PAYMENT_SERVICE_URL       ?? 'http://localhost:3007';
  const NOTIFICATION_SERVICE_URL  = process.env.NOTIFICATION_SERVICE_URL  ?? 'http://localhost:3009';

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const expressApp = app.getHttpAdapter().getInstance();

  // USER
  mountProxy(expressApp, '/api/v1/auth', USER_SERVICE_URL);
  mountProxy(expressApp, '/api/v1/users', USER_SERVICE_URL);
  mountProxy(expressApp, '/api/v1/addresses', USER_SERVICE_URL);
  mountProxy(expressApp, '/api/v1/users/me/fcm-tokens', USER_SERVICE_URL);
  mountProxy(expressApp, '/internal/users', USER_SERVICE_URL);

  // PRODUCT
  mountProxy(expressApp, '/api/v1/products', PRODUCT_SERVICE_URL);
  mountProxy(expressApp, '/internal/products', PRODUCT_SERVICE_URL);

  // ORDER
  mountProxy(expressApp, '/api/v1/orders', ORDER_SERVICE_URL);
  mountProxy(expressApp, '/internal/orders', ORDER_SERVICE_URL);
  
  // INVENTORY
  mountProxy(expressApp, '/api/v1/inventory', INVENTORY_SERVICE_URL);
  mountProxy(expressApp, '/internal/inventory', INVENTORY_SERVICE_URL);

  // REVIEW
  mountProxy(expressApp, '/api/v1/reviews', REVIEW_SERVICE_URL);
  mountProxy(expressApp, '/api/v1/comments', REVIEW_SERVICE_URL);
  mountProxy(expressApp, '/api/v1/uploads', REVIEW_SERVICE_URL);
  mountProxy(expressApp, '/internal/reviews', REVIEW_SERVICE_URL);

  // ── CONFIG SERVICE ────────────────────────────────────────────────────────
  expressApp.use('/api/v1/config',     makeProxy(CONFIG_SERVICE_URL));
  expressApp.use('/internal/config',   makeProxy(CONFIG_SERVICE_URL));

  // PAYMENT
  mountProxy(expressApp, '/api/v1/payments', PAYMENT_SERVICE_URL);
  mountProxy(expressApp, '/internal/payments', PAYMENT_SERVICE_URL);

  // NOTIFICATION
  mountProxy(expressApp, '/api/v1/notifications', NOTIFICATION_SERVICE_URL);
  mountProxy(expressApp, '/internal/notifications', NOTIFICATION_SERVICE_URL);

  // PROMOTION
  mountProxy(expressApp, '/api/v1/promotions', PROMOTION_SERVICE_URL);
  mountProxy(expressApp, '/internal/promotions', PROMOTION_SERVICE_URL);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(port);

  logger.log('========================================');
  logger.log('✅ API Gateway running');
  logger.log(`   Port    : http://localhost:${port}`);
  logger.log(`   user    → ${USER_SERVICE_URL}`);
  logger.log(`   product → ${PRODUCT_SERVICE_URL}`);
  logger.log(`   order   → ${ORDER_SERVICE_URL}`);
  logger.log(`   invent  → ${INVENTORY_SERVICE_URL}`);
  logger.log(`   review  → ${REVIEW_SERVICE_URL}`);
  logger.log(`   config  → ${CONFIG_SERVICE_URL}`);
  logger.log(`   payment → ${PAYMENT_SERVICE_URL}`);
  logger.log(`   notif   → ${NOTIFICATION_SERVICE_URL}`);
  logger.log(`   promo   → ${PROMOTION_SERVICE_URL}`);
  logger.log('========================================');
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start API Gateway:', err);
  process.exit(1);
});