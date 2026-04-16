import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import { PaymentService } from './payment-service.service';
import { CreatePaymentDto } from '../dto/create-payment.dto'; // Đảm bảo đã tạo file DTO này

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-url')
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() req: any,
  ) {
    // Lấy IP thật hoặc mặc định localhost
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      '127.0.0.1';

    // Phải có await vì hàm service là async (đang đụng vào DB)
    const url = await this.paymentService.createPaymentUrl(
      createPaymentDto.amount,
      createPaymentDto.orderId,
      ipAddress,
    );

    return { url };
  }
  @Get('vnpay_return')
  async vnpayReturn(@Query() query: any) {
    const result = await this.paymentService.updatePaymentStatus(query);

    return {
      message: query.vnp_ResponseCode === '00' ? 'Thành công' : 'Thất bại',
      orderId: result.orderId, // Đổi từ order_id -> orderId
      status: result.status,
    };
  }
}
