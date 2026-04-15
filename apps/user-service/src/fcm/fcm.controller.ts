import { Controller, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { RegisterFcmDto } from './dto/register-fcm.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('users/me/fcm-token')
export class FcmController {
  constructor(private readonly fcmService: FcmService) { }

  // POST /users/me/fcm-token
  @Post()
  @HttpCode(HttpStatus.OK)
  async registerToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterFcmDto,
  ) {
    return this.fcmService.registerToken(user.userId, dto);
  }

  // DELETE /users/me/fcm-token/:token
  @Delete(':token')
  @HttpCode(HttpStatus.OK)
  async removeToken(
    @CurrentUser() user: CurrentUserPayload,
    @Param('token') token: string,
  ) {
    return this.fcmService.removeToken(user.userId, token);
  }
}
