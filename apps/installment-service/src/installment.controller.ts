import { Controller, Get, Post, Body, Patch, Param, Query } from '@nestjs/common';
import { InstallmentService } from './installment.service';
import { ApplyInstallmentDto } from './dto/apply-installment.dto';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from './common/decorators/current-user.decorator';

@Controller('installments')
export class InstallmentController {
  constructor(private readonly installmentService: InstallmentService) {}

  @Get('plans')
  @Public()
  async getPlans() {
    return this.installmentService.getAllPlans();
  }

  @Post('apply')
  @Roles('customer', 'staff', 'admin')
  async applyInstallment(@Body() body: ApplyInstallmentDto, @CurrentUser() user: UserPayload) {
    return this.installmentService.applyForInstallment(user, body);
  }

  @Get('applications')
  @Roles('admin', 'staff')
  async getApplications(@Query('status') status?: string, @CurrentUser() user?: UserPayload) {
    return this.installmentService.getApplications(status, user);
  }

  @Get('applications/:id')
  @Roles('customer', 'staff', 'admin')
  async getApplicationById(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.installmentService.getApplicationById(id, user);
  }

  @Get('applications/:id/schedules')
  @Roles('customer', 'staff', 'admin')
  async getApplicationSchedules(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.installmentService.getApplicationSchedules(id, user);
  }

  @Get('applications/order/:orderId')
  @Roles('customer', 'staff', 'admin')
  async getMyApplicationByOrder(@Param('orderId') orderId: string, @CurrentUser() user: UserPayload) {
    return this.installmentService.getMyApplicationByOrder(orderId, user);
  }

  @Patch('applications/:id/approve')
  @Roles('admin', 'staff')
  async approveApplication(@Param('id') id: string) {
    return this.installmentService.approveApplication(id);
  }

  @Patch('applications/:id/reject')
  @Roles('admin', 'staff')
  async rejectApplication(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.installmentService.rejectApplication(id, body?.reason);
  }

  @Patch('schedules/:id/mark-paid')
  @Roles('admin', 'staff')
  async markSchedulePaid(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: UserPayload,
  ) {
    return this.installmentService.markScheduleAsPaid(id, body?.note, user);
  }
}