import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { EmailLogsService } from './email-logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationService } from '../notification/notification.service';
import { EmailLogNotFoundException, CannotResendException } from '../common/exceptions';
import { EmailStatus } from '@prisma/notification-client';

@Controller('notifications/logs')
@UseGuards(RolesGuard)
export class EmailLogsController {
  constructor(
    private readonly emailLogsService: EmailLogsService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('stats')
  @Roles('admin')
  getStats(@Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string) {
    return this.emailLogsService.getStats(fromDate, toDate);
  }

  @Get()
  @Roles('admin', 'staff')
  findAll(@Query() query: QueryLogsDto) {
    return this.emailLogsService.findAll(query);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.emailLogsService.findOne(id);
  }

  @Post(':id/resend')
  @Roles('admin')
  async resend(@Param('id') id: string) {
    const log = await this.emailLogsService.findOne(id);
    if (log.status !== EmailStatus.PERMANENTLY_FAILED) {
      throw new CannotResendException('Chỉ resend được email PERMANENTLY_FAILED');
    }
    await this.notificationService.resendFailed(id);
    return { message: 'Đang gửi lại email', logId: id };
  }
}
