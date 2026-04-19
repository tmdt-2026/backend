import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
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
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Req() req: any) {
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      '127.0.0.1';

    const url = await this.paymentService.createPaymentUrl(
      createPaymentDto.amount,
      createPaymentDto.orderId,
      ipAddress,
    );

    return { url };
  }

  /** VNPay callback — public (webhook từ cổng thanh toán) */
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
}
