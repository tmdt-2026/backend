import { Body, Controller, Get, Param, Post, Patch, Query } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order-service.service';

@Controller('orders')
export class OrderServiceController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get()
  getAllOrders(@Query('status') status?: string) {
    return this.orderService.getAllOrders(status);
  }

  @Get(':id')
  getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }
  @Patch(':id/status')
updateStatus(
  @Param('id') id: string,
  @Body() dto: UpdateOrderStatusDto,
) {
  return this.orderService.updateStatus(id, dto);
}
  @Post(':id/cancel')
cancelOrder(@Param('id') id: string) {
  return this.orderService.cancelOrder(id);
}
}