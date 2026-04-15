import * as dotenv from 'dotenv';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Vì file .env nằm trong apps/payment-service/, ta dùng __dirname để tìm ngược lại
  // Khi chạy dev, __dirname thường là apps/payment-service/src
  dotenv.config({ path: join(__dirname, '../../payment-service', '.env') });

  const app = await NestFactory.create(PaymentModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3002;
  await app.listen(port);

  console.log(`🚀 Payment-service is running on: http://localhost:${port}/api`);
  // Kiểm tra biến quan trọng nhất
  console.log(
    `🔗 Database URL: ${process.env.DATABASE_URL ? 'Đã nhận ✅' : 'Chưa tìm thấy file .env tại đường dẫn này ❌'}`,
  );
}
bootstrap();
