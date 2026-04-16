import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('notifications/templates')
@UseGuards(RolesGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @Roles('admin', 'staff')
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':key')
  @Roles('admin')
  findOne(@Param('key') key: string) {
    return this.templatesService.findOne(key);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateTemplateDto, @CurrentUser() user: CurrentUserPayload) {
    return this.templatesService.create(dto, user.userId);
  }

  @Put(':key')
  @Roles('admin')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.templatesService.update(key, dto, user.userId);
  }

  @Delete(':key')
  @Roles('admin')
  remove(@Param('key') key: string) {
    return this.templatesService.remove(key);
  }

  @Post(':key/preview')
  @Roles('admin')
  preview(@Param('key') key: string, @Body() dto: PreviewTemplateDto) {
    return this.templatesService.preview(key, dto.variables ?? {});
  }
}
