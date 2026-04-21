import { Controller, Post, Body, Req, Get, Query, Param } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PaymentService } from './payment-service.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @MessagePattern({ cmd: 'ping' })
  ping() {
    return { success: true, data: 'payment-service pong' };
  }

  /** Tạo URL thanh toán — customer/staff/admin */
  @Post('create-url')
  @Roles('customer', 'staff', 'admin')
  async createPayment(@Body() dto: CreatePaymentDto, @Req() req: any) {
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      '127.0.0.1';

    return this.paymentService.createPaymentUrl(dto, ipAddress);
  }

  /** VNPay callback — public (webhook từ cổng thanh toán).
   *  Must be declared BEFORE /:transactionId to avoid param capture. */
  @Get('vnpay_return')
  @Public()
  async vnpayReturn(@Query() query: any) {
    const result = await this.paymentService.updatePaymentStatus(query);

    return {
      message: query.vnp_ResponseCode === '00' ? 'Thành công' : 'Thất bại',
      orderId: result.orderId,
      status: result.status,
    };
  }

  /** Lấy chi tiết giao dịch — customer/staff/admin */
  @Get(':transactionId')
  @Roles('customer', 'staff', 'admin')
  getTransaction(@Param('transactionId') transactionId: string) {
    return this.paymentService.getTransaction(transactionId);
  }
}
