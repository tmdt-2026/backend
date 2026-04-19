import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InstallmentService } from './installment.service';
import { ApplyInstallmentDto } from './dto/apply-installment.dto';

@ApiTags('Installment (Trả góp)')
@Controller('installments')
export class InstallmentController {
  constructor(private readonly installmentService: InstallmentService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Xem danh sách các gói trả góp' })
  async getPlans() {
    return this.installmentService.getAllPlans();
  }

  @Post('apply')
  @ApiOperation({ summary: 'Đăng ký trả góp cho đơn hàng' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  async applyInstallment(@Body() body: ApplyInstallmentDto) {
    return this.installmentService.applyForInstallment(
      body.userId, 
      body.orderId, 
      body.planId, 
      body.orderTotal
    );
  }
}