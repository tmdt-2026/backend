import {
  Controller, Get, Post, Patch, Param, Body, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ImportStockDto } from './dto/import-stock.dto';
import { AdjustmentDto } from './dto/adjustment.dto';
import { UpdateThresholdDto } from './dto/update-threshold.dto';
import { BulkCheckDto } from './dto/bulk-check.dto';
import { QueryInventoryDto, QueryTransactionsDto, QueryLowStockDto } from './dto/query-inventory.dto';
import { CurrentUser, UserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('admin', 'staff')
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('low-stock')
  @Roles('admin', 'staff')
  getLowStock(@Query() query: QueryLowStockDto) {
    return this.inventoryService.getLowStock(query);
  }

  @Post('bulk-check')
  @UseGuards(ServiceAuthGuard)
  @HttpCode(HttpStatus.OK)
  bulkCheck(@Body() dto: BulkCheckDto) {
    return this.inventoryService.bulkCheck(dto);
  }

  @Get(':variantId')
  @Roles('admin', 'staff')
  findOne(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventoryService.findOne(variantId);
  }

  @Get(':variantId/transactions')
  @Roles('admin', 'staff')
  getTransactions(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query() query: QueryTransactionsDto,
  ) {
    return this.inventoryService.getTransactions(variantId, query);
  }

  @Post(':variantId/import')
  @Roles('admin', 'staff')
  @HttpCode(HttpStatus.CREATED)
  importStock(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: ImportStockDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.inventoryService.importStock(variantId, dto, user.userId);
  }

  @Post(':variantId/adjustment')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  adjustment(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: AdjustmentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.inventoryService.adjustment(variantId, dto, user.userId);
  }

  @Patch(':variantId/threshold')
  @Roles('admin')
  updateThreshold(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateThresholdDto,
  ) {
    return this.inventoryService.updateThreshold(variantId, dto.lowStockThreshold);
  }
}
