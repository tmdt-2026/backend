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
    onError: (err, _req, res: any) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: { code: 'BAD_GATEWAY', message: 'Service unavailable', statusCode: 502 },
        }));
      }
    },
  });
}

async function bootstrap() {
  const logger = new Logger('APIGateway');
  const port = parseInt(process.env.TMDT_PORT ?? process.env.PORT ?? '3000', 10);

  // Service URLs — Docker: use service names; Local dev: use localhost
  const USER_SERVICE_URL      = process.env.USER_SERVICE_URL      ?? 'http://localhost:3001';
  const PRODUCT_SERVICE_URL   = process.env.PRODUCT_SERVICE_URL   ?? 'http://localhost:3004';
  const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:3003';
  const REVIEW_SERVICE_URL    = process.env.REVIEW_SERVICE_URL    ?? 'http://localhost:3002';
  const CONFIG_SERVICE_URL    = process.env.CONFIG_SERVICE_URL    ?? 'http://localhost:3011';

  // Disable NestJS body parser — let http-proxy-middleware stream raw bodies
  // (required for multipart/form-data file uploads to pass through correctly)
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const expressApp = app.getHttpAdapter().getInstance();

  // ── USER SERVICE ──────────────────────────────────────────────────────────
  expressApp.use('/api/v1/auth',       makeProxy(USER_SERVICE_URL));
  expressApp.use('/api/v1/users',      makeProxy(USER_SERVICE_URL));
  expressApp.use('/api/v1/addresses',  makeProxy(USER_SERVICE_URL));
  expressApp.use('/api/v1/fcm',        makeProxy(USER_SERVICE_URL));
  expressApp.use('/internal/users',    makeProxy(USER_SERVICE_URL));

  // ── PRODUCT SERVICE ───────────────────────────────────────────────────────
  expressApp.use('/api/v1/products',   makeProxy(PRODUCT_SERVICE_URL));
  expressApp.use('/internal/products', makeProxy(PRODUCT_SERVICE_URL));

  // ── INVENTORY SERVICE ─────────────────────────────────────────────────────
  expressApp.use('/api/v1/inventory',    makeProxy(INVENTORY_SERVICE_URL));
  expressApp.use('/internal/inventory',  makeProxy(INVENTORY_SERVICE_URL));

  // ── REVIEW SERVICE ────────────────────────────────────────────────────────
  expressApp.use('/api/v1/reviews',    makeProxy(REVIEW_SERVICE_URL));
  expressApp.use('/api/v1/comments',   makeProxy(REVIEW_SERVICE_URL));
  expressApp.use('/api/v1/uploads',    makeProxy(REVIEW_SERVICE_URL));
  expressApp.use('/internal/reviews',  makeProxy(REVIEW_SERVICE_URL));

  // ── CONFIG SERVICE ────────────────────────────────────────────────────────
  expressApp.use('/api/v1/config',     makeProxy(CONFIG_SERVICE_URL));
  expressApp.use('/internal/config',   makeProxy(CONFIG_SERVICE_URL));

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
  logger.log(`   invent  → ${INVENTORY_SERVICE_URL}`);
  logger.log(`   review  → ${REVIEW_SERVICE_URL}`);
  logger.log(`   config  → ${CONFIG_SERVICE_URL}`);
  logger.log('========================================');
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start API Gateway:', err);
  process.exit(1);
});
