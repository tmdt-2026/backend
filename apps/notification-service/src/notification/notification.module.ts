import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { TemplatesRepository } from '../templates/templates.repository';
import { EmailLogsRepository } from '../email-logs/email-logs.repository';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, TemplatesRepository, EmailLogsRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
