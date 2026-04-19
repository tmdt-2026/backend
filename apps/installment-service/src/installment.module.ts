import { Module } from '@nestjs/common';
import { InstallmentController } from './installment.controller';
import { InstallmentService } from './installment.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], 
  controllers: [InstallmentController],
  providers: [InstallmentService],
})
export class InstallmentModule {}