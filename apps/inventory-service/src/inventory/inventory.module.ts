import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PublishersModule } from '../publishers/publishers.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PublishersModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
