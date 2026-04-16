import { Module } from '@nestjs/common';
import { UserEventsConsumer } from './user-events.consumer';
import { OrderEventsConsumer } from './order-events.consumer';
import { PaymentEventsConsumer } from './payment-events.consumer';
import { InstallmentEventsConsumer } from './installment-events.consumer';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [
    UserEventsConsumer,
    OrderEventsConsumer,
    PaymentEventsConsumer,
    InstallmentEventsConsumer,
  ],
})
export class ConsumersModule {}
