import { Module } from '@nestjs/common';
import { PaymentController } from './payment-service.controller';
import { PaymentService } from './payment-service.service';
import { PrismaService } from '../prisma/prisma.service'; // Kiểm tra lại đường dẫn này

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
})
export class PaymentModule {}