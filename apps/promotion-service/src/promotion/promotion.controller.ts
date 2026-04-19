import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto, UpdatePromotionDto, ApplyPromotionDto } from '../dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  /** Tạo promotion — chỉ admin */
  @Post()
  @Roles('admin')
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionService.create(dto);
  }

  /** Xem danh sách promotion — public (hiển thị trên frontend) */
  @Get()
  @Public()
  findAll(@Query() query: any) {
    return this.promotionService.findAll(query);
  }

  /** Xem chi tiết promotion — public */
  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.promotionService.findOne(id);
  }

  /** Cập nhật promotion — chỉ admin */
  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotionService.update(id, dto);
  }

  /** Xóa promotion — chỉ admin */
  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.promotionService.remove(id);
  }

  /** Áp dụng promotion — customer/staff/admin */
  @Post('apply')
  @Roles('customer', 'staff', 'admin')
  apply(@Body() dto: ApplyPromotionDto) {
    return this.promotionService.applyPromotion(dto);
  }
}
