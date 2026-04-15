import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { QuerySettingsByGroupDto } from './dto/query-settings.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('config/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** GET /config/settings — all public settings as parsed flat object */
  @Get()
  @Public()
  getAllPublic() {
    return this.settingsService.getPublicSettings();
  }

  /** GET /config/settings/group/:group */
  @Get('group/:group')
  @Roles('admin', 'staff')
  getByGroup(
    @Param('group') group: string,
    @Query() query: QuerySettingsByGroupDto,
    @CurrentUser() user: UserPayload,
  ) {
    const isAdmin = user.roles.includes('admin');
    return this.settingsService.findByGroup(group, query.includePrivate ?? false, isAdmin);
  }

  /** GET /config/settings/:key */
  @Get(':key')
  getByKey(@Param('key') key: string, @CurrentUser() user: UserPayload) {
    const isAdmin = user?.roles?.includes('admin') ?? false;
    return this.settingsService.findByKey(key, isAdmin);
  }

  /** POST /config/settings — admin only */
  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSettingDto, @CurrentUser() user: UserPayload) {
    return this.settingsService.create(dto, user.userId);
  }

  /** PUT /config/settings/:key — admin only */
  @Put(':key')
  @Roles('admin')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.settingsService.update(key, dto, user.userId);
  }

  /** DELETE /config/settings/:key — admin only */
  @Delete(':key')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('key') key: string) {
    await this.settingsService.remove(key);
    return { message: 'Đã xoá setting' };
  }
}
