import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { SendEmailDto } from '../notification/dto/send-email.dto';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';

@Controller('internal/notifications')
@UseGuards(ServiceAuthGuard)
export class InternalController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  async send(@Body() dto: SendEmailDto) {
    const log = await this.notificationService.sendEmail(dto);
    return { logId: log.id, status: log.status };
  }
}
