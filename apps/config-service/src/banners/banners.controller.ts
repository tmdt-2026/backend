import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
  HttpCode, HttpStatus, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banners.dto';
import { QueryBannersDto } from './dto/query-banners.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

class ToggleBannerDto {
  @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  isActive: boolean;
}

@Controller('config/banners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  /** GET /config/banners?position=home_main — public, active banners */
  @Get()
  @Public()
  getActive(@Query('position') position?: string) {
    return this.bannersService.getActive(position);
  }

  /** GET /config/banners/all — admin/staff */
  @Get('all')
  @Roles('admin', 'staff')
  getAll(@Query() query: QueryBannersDto) {
    return this.bannersService.getAll(query);
  }

  /** POST /config/banners — admin */
  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBannerDto, @CurrentUser() user: UserPayload) {
    return this.bannersService.create(dto, user.userId);
  }

  /** PATCH /config/banners/reorder — admin */
  @Patch('reorder')
  @Roles('admin')
  reorder(@Body() dto: ReorderBannersDto) {
    return this.bannersService.reorder(dto);
  }

  /** PUT /config/banners/:id — admin */
  @Put(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.bannersService.update(id, dto, user.userId);
  }

  /** DELETE /config/banners/:id — admin */
  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.bannersService.remove(id);
    return { message: 'Đã xoá banner' };
  }

  /** PATCH /config/banners/:id/toggle — admin */
  @Patch(':id/toggle')
  @Roles('admin')
  toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleBannerDto,
  ) {
    return this.bannersService.toggle(id, dto.isActive);
  }

  /** POST /config/banners/:id/track-click — public */
  @Post(':id/track-click')
  @Public()
  @HttpCode(HttpStatus.OK)
  async trackClick(@Param('id', ParseUUIDPipe) id: string) {
    await this.bannersService.trackClick(id);
    return { success: true };
  }
}
