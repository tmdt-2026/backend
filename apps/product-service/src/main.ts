// apps/product-service/src/main.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

// PHẢI NẠP ENV TRƯỚC KHI IMPORT APP MODULE
// Điều này giúp process.env có giá trị ngay khi NestJS khởi tạo các Provider (như Prisma)
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { ProductServiceModule } from './product-service.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Main');

  const app = await NestFactory.create(ProductServiceModule);

  // 1. Cấu hình Cors để Frontend (HTML file) có thể gọi API
  app.enableCors();

  // 2. Cấu hình Global Prefix
  app.setGlobalPrefix('api');

  // 3. Cấu hình Validation (Để các DTO @Min, @IsString hoạt động)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Cho phép các trường không có trong DTO (như id, createdAt) mà không bị lỗi
    }),
  );

  const port = process.env.PORT || 3002;
  await app.listen(port);

  logger.log(`🚀 Product Service is running on http://localhost:${port}`);

  // Kiểm tra biến môi trường
  if (process.env.DATABASE_URL) {
    logger.log('✅ DATABASE_URL: Loaded');
  } else {
    logger.warn(
      '⚠️  DATABASE_URL: Missing (Using hardcoded value if available)',
    );
  }
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
