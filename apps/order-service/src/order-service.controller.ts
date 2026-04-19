import { Body, Controller, Get, Param, Post, Patch, Delete, Query } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order-service.service';
import { Roles } from './common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from './common/decorators/current-user.decorator';

@Controller('orders')
export class OrderServiceController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern({ cmd: 'ping' })
  ping() {
    return { success: true, data: 'order-service pong' };
  }

  /** Lấy order theo id qua RMQ — dùng bởi review-service */
  @MessagePattern({ cmd: 'order.get-by-id' })
  getOrderByIdRpc(@Payload() payload: { id: string }) {
    return this.orderService.getOrderByIdForRpc(payload.id);
  }

  /** Tạo đơn hàng — customer/staff/admin */
  @Post()
  @Roles('customer', 'staff', 'admin')
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: UserPayload) {
    return this.orderService.createOrder(dto);
  }

  /** Xem danh sách đơn — chỉ staff/admin */
  @Get()
  @Roles('admin', 'staff')
  getAllOrders(@Query('status') status?: string) {
    return this.orderService.getAllOrders(status);
  }

  /** Xem chi tiết đơn — customer/staff/admin */
  @Get(':id')
  @Roles('customer', 'staff', 'admin')
  getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  /** Cập nhật trạng thái — chỉ staff/admin */
  @Patch(':id/status')
updateStatus(
  @Param('id') id: string,
  @Body() dto: UpdateOrderStatusDto,
) {
  return this.orderService.updateStatus(id, dto);
}
  @Delete(':id')
deleteOrder(@Param('id') id: string) {
  return this.orderService.deleteOrder(id);
}
  @Post(':id/cancel')
  @Roles('customer', 'staff', 'admin')
  cancelOrder(@Param('id') id: string) {
    return this.orderService.cancelOrder(id);
  }
}
