import { Controller, Post, Body, Req, Get, Query, Param } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { PaymentService } from './payment-service.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from './common/decorators/current-user.decorator';

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

  /** FE confirms VNPay callback when user is redirected to frontend returnUrl */
  @Post('vnpay_confirm')
  @Public()
  async vnpayConfirm(@Body() payload: Record<string, any>) {
    const result = await this.paymentService.updatePaymentStatus(payload);
    return {
      message: payload.vnp_ResponseCode === '00' ? 'Thành công' : 'Thất bại',
      orderId: result.orderId,
      status: result.status,
    };
  }

  /** Lấy giao dịch theo đơn hàng — customer/staff/admin */
  @Get('order/:orderId')
  @Roles('customer', 'staff', 'admin')
  getTransactionByOrderId(@Param('orderId') orderId: string, @CurrentUser() user: UserPayload) {
    return this.paymentService.getTransactionByOrderId(orderId, user);
  }

  /** Tạo lại URL thanh toán VNPay cho đơn chưa thanh toán */
  @Post('order/:orderId/retry-url')
  @Roles('customer', 'staff', 'admin')
  retryPaymentUrl(
    @Param('orderId') orderId: string,
    @Body('returnUrl') returnUrl: string | undefined,
    @Req() req: any,
    @CurrentUser() user: UserPayload,
  ) {
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      '127.0.0.1';

    return this.paymentService.retryPaymentUrl(orderId, user, ipAddress, returnUrl);
  }

  /** Danh sách giao dịch — admin/staff */
  @Get()
  @Roles('admin', 'staff')
  listTransactions(@Query('status') status?: string, @Query('orderId') orderId?: string) {
    return this.paymentService.listTransactions(status, orderId);
  }

  /** Lấy chi tiết giao dịch — customer/staff/admin
   *  Must be last to avoid capturing /order/... routes. */
  @Get(':transactionId')
  @Roles('customer', 'staff', 'admin')
  getTransaction(@Param('transactionId') transactionId: string, @CurrentUser() user: UserPayload) {
    return this.paymentService.getTransaction(transactionId, user);
  }
}
