import { Module } from '@nestjs/common';
import { EmailLogsController } from './email-logs.controller';
import { EmailLogsService } from './email-logs.service';
import { EmailLogsRepository } from './email-logs.repository';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [EmailLogsController],
  providers: [EmailLogsService, EmailLogsRepository],
  exports: [EmailLogsService, EmailLogsRepository],
})
export class EmailLogsModule {}
