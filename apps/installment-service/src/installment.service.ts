import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from './common/decorators/current-user.decorator';
import { InstallmentPublisher } from './publishers/installment.publisher';

@Injectable()
export class InstallmentService {
  private readonly orderServiceUrl = `${process.env.ORDER_SERVICE_URL ?? 'http://order-service:3005'}/api/v1`;
  private readonly userServiceUrl = `${process.env.USER_SERVICE_URL ?? 'http://user-service:3001'}/api/v1`;
  private readonly internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token-change-in-production';
  private readonly frontendBaseUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'http://localhost:3000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: InstallmentPublisher,
  ) {}

  private isPrivileged(user?: UserPayload) {
    return Boolean(user?.roles?.includes('admin') || user?.roles?.includes('staff'));
  }

  private async ensureDefaultPlans() {
    const count = await this.prisma.installmentPlan.count();
    if (count > 0) return;

    await this.prisma.installmentPlan.createMany({
      data: [
        { name: 'Trả góp 3 tháng 0%', duration_months: 3, interest_rate: 0, min_order_value: 3000000, is_active: true },
        { name: 'Trả góp 6 tháng 0%', duration_months: 6, interest_rate: 0, min_order_value: 5000000, is_active: true },
        { name: 'Trả góp 12 tháng 8%', duration_months: 12, interest_rate: 0.08, min_order_value: 8000000, is_active: true },
      ],
    });
  }

  private async getOrderByIdInternal(orderId: string) {
    const response = await axios.get(
      `${this.orderServiceUrl}/orders/internal/${orderId}?token=${encodeURIComponent(this.internalServiceToken)}`,
    );
    return response.data?.data ?? response.data;
  }

  private async getUserProfile(userId: string): Promise<{ userEmail: string; userName: string }> {
    try {
      const response = await axios.get(`${this.userServiceUrl}/internal/users/${userId}`, {
        headers: { 'X-Service-Token': this.internalServiceToken },
      });
      const user = response.data?.data ?? response.data;
      return {
        userEmail: user.email ?? '',
        userName: user.userName ?? user.fullName ?? 'Khách hàng',
      };
    } catch {
      return {
        userEmail: '',
        userName: 'Khách hàng',
      };
    }
  }

  private buildFrontendUrl(path: string) {
    return `${this.frontendBaseUrl.replace(/\/$/, '')}${path}`;
  }

  private assertCanViewApplication(application: { user_id: string }, user: UserPayload) {
    if (this.isPrivileged(user)) return;
    if (application.user_id !== user.userId) {
      throw new ForbiddenException('Bạn không có quyền xem hồ sơ trả góp này');
    }
  }

  async getAllPlans() {
    await this.ensureDefaultPlans();
    return this.prisma.installmentPlan.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async getApplications(status?: string, user?: UserPayload) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowed = ['pending', 'approved', 'rejected'];
    const where = {
      ...(normalizedStatus && allowed.includes(normalizedStatus) ? { status: normalizedStatus } : {}),
      ...(!this.isPrivileged(user) && user?.userId ? { user_id: user.userId } : {}),
    };

    return this.prisma.installmentApplication.findMany({
      where,
      include: {
        plan: true,
        schedules: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getApplicationById(id: string, user: UserPayload) {
    const application = await this.prisma.installmentApplication.findUnique({
      where: { id },
      include: {
        plan: true,
        schedules: {
          orderBy: { due_date: 'asc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ trả góp');
    }

    this.assertCanViewApplication(application, user);

    return application;
  }

  async getApplicationSchedules(id: string, user: UserPayload) {
    await this.getApplicationById(id, user);

    return this.prisma.installmentSchedule.findMany({
      where: { application_id: id },
      orderBy: { due_date: 'asc' },
    });
  }

  calculateMonthlyPayment(loanAmount: number, months: number, interestRate: number): number {
    if (months <= 0) throw new BadRequestException('Số tháng không hợp lệ');
    
    if (interestRate === 0) {
      return loanAmount / months; // Lãi suất 0%
    }
    
    const totalInterest = loanAmount * interestRate * (months / 12);
    const totalPayable = loanAmount + totalInterest;
    return totalPayable / months;
  }

  async applyForInstallment(requester: UserPayload, orderId: string, planId: string, orderTotal: number) {
    if (!Number.isFinite(Number(orderTotal)) || Number(orderTotal) <= 0) {
      throw new BadRequestException('Tổng tiền đơn hàng không hợp lệ.');
    }
    await this.ensureDefaultPlans();

    // A. Kiểm tra gói trả góp có tồn tại trong DB không
    const plan = await this.prisma.installmentPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) throw new NotFoundException('Không tìm thấy gói trả góp này!');

    const order = await this.getOrderByIdInternal(orderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng để áp dụng trả góp.');
    }

    const orderOwnerId = order.user_id ?? order.userId;
    if (!this.isPrivileged(requester) && orderOwnerId !== requester.userId) {
      throw new ForbiddenException('Bạn không có quyền đăng ký trả góp cho đơn hàng này.');
    }

    if ((order.payment_type ?? order.paymentType) !== 'installment') {
      throw new BadRequestException('Đơn hàng này không được tạo theo phương thức trả góp.');
    }

    const totalFromOrder = Number(order.final_amount ?? order.total_price ?? order.total_amount ?? orderTotal);
    const effectiveOrderTotal = Number.isFinite(totalFromOrder) && totalFromOrder > 0
      ? totalFromOrder
      : Number(orderTotal);

    if (effectiveOrderTotal < plan.min_order_value) {
      throw new BadRequestException(`Đơn hàng phải từ ${plan.min_order_value} mới được áp dụng gói này.`);
    }

    const existing = await this.prisma.installmentApplication.findFirst({
      where: { order_id: orderId },
    });
    if (existing) {
      throw new BadRequestException('Đơn hàng này đã có hồ sơ trả góp.');
    }

    const monthlyPayment = this.calculateMonthlyPayment(effectiveOrderTotal, plan.duration_months, plan.interest_rate);
    let result;
    try {
      result = await this.prisma.installmentApplication.create({
        data: {
          user_id: String(orderOwnerId || requester.userId),
          order_id: orderId,
          plan_id: planId,
          status: 'pending',
          total_amount: effectiveOrderTotal,
          loan_amount: effectiveOrderTotal,
          monthly_payment: monthlyPayment,
        }
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('Đơn hàng này đã có hồ sơ trả góp.');
      }
      throw error;
    }

    return {
      message: 'Đăng ký trả góp thành công. Hồ sơ đang chờ duyệt.',
      applicationDetails: result
    };
  }

  async approveApplication(id: string) {
    const application = await this.prisma.installmentApplication.findUnique({
      where: { id },
      include: { plan: true, schedules: true },
    });

    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ trả góp');
    }

    if (application.status === 'rejected') {
      throw new BadRequestException('Hồ sơ đã bị từ chối, không thể duyệt lại.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.installmentApplication.update({
        where: { id },
        data: { status: 'approved' },
      });

      if (application.schedules.length > 0) {
        return;
      }

      const schedulesData = [];
      for (let i = 1; i <= application.plan.duration_months; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i);

        schedulesData.push({
          application_id: application.id,
          due_date: dueDate,
          amount_due: application.monthly_payment,
          status: 'unpaid'
        });
      }

      await tx.installmentSchedule.createMany({
        data: schedulesData,
      });
    });

    const approved = await this.prisma.installmentApplication.findUnique({
      where: { id },
      include: {
        plan: true,
        schedules: { orderBy: { due_date: 'asc' } },
      },
    });

    if (!approved) {
      throw new NotFoundException('Không tìm thấy hồ sơ trả góp');
    }

    try {
      const profile = await this.getUserProfile(approved.user_id);
      await this.publisher.publishInstallmentApproved({
        applicationId: approved.id,
        orderCode: approved.order_id,
        userEmail: profile.userEmail,
        userName: profile.userName,
        planName: approved.plan?.name ?? 'Gói trả góp',
        monthlyPayment: Number(approved.monthly_payment || 0).toFixed(2),
        totalMonths: approved.plan?.duration_months ?? approved.schedules.length,
        firstDueDate: approved.schedules?.[0]?.due_date?.toISOString?.() ?? '',
        scheduleUrl: this.buildFrontendUrl(`/order-detail.html?id=${approved.order_id}`),
      });
    } catch {
      // ignore notification failures to avoid blocking approval
    }

    return approved;
  }

  async rejectApplication(id: string, reason?: string) {
    const application = await this.prisma.installmentApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ trả góp');
    }

    if (application.status === 'approved') {
      throw new BadRequestException('Hồ sơ đã duyệt, không thể từ chối.');
    }

    const updated = await this.prisma.installmentApplication.update({
      where: { id },
      data: { status: 'rejected' },
    });

    try {
      const profile = await this.getUserProfile(updated.user_id);
      await this.publisher.publishInstallmentRejected({
        applicationId: updated.id,
        orderCode: updated.order_id,
        userEmail: profile.userEmail,
        userName: profile.userName,
        rejectReason: reason || 'Hồ sơ chưa đáp ứng điều kiện duyệt.',
        supportUrl: this.buildFrontendUrl('/support'),
      });
    } catch {
      // ignore notification failures to avoid blocking rejection
    }

    return {
      message: reason ? `Đã từ chối hồ sơ: ${reason}` : 'Đã từ chối hồ sơ',
      application: updated,
    };
  }
}