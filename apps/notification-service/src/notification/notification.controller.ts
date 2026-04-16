import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { BroadcastDto } from './dto/broadcast.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('broadcast')
  @Roles('admin')
  broadcast(@Body() dto: BroadcastDto, @CurrentUser() user: CurrentUserPayload) {
    return this.notificationService.broadcast(dto, user.userId);
  }
}
