import { NestFactory } from '@nestjs/core';
import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.create(OrderServiceModule);
  await app.listen(3005);
  console.log('🚀 Order Service running on port 3005');
}
bootstrap();