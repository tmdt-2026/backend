import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [InternalController],
})
export class InternalModule {}
