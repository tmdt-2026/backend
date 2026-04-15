import { Module } from '@nestjs/common';
import { OrderEventsConsumer } from './order-events.consumer';
import { ProductEventsConsumer } from './product-events.consumer';
import { InventoryModule } from '../inventory/inventory.module';
import { PublishersModule } from '../publishers/publishers.module';

@Module({
  imports: [InventoryModule, PublishersModule],
  controllers: [OrderEventsConsumer, ProductEventsConsumer],
})
export class ConsumersModule {}
