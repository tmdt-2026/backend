import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderServiceController } from './order-service.controller';
import { OrderService } from './order-service.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrderServiceController],
  providers: [OrderService],
})
export class OrderServiceModule {}