import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstallmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllPlans() {
    return this.prisma.installmentPlan.findMany({
      where: { is_active: true },
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

  async applyForInstallment(userId: string, orderId: string, planId: string, orderTotal: number) {
    // A. Kiểm tra gói trả góp có tồn tại trong DB không
    const plan = await this.prisma.installmentPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) throw new NotFoundException('Không tìm thấy gói trả góp này!');
    if (orderTotal < plan.min_order_value) {
      throw new BadRequestException(`Đơn hàng phải từ ${plan.min_order_value} mới được áp dụng gói này.`);
    }
    const monthlyPayment = this.calculateMonthlyPayment(orderTotal, plan.duration_months, plan.interest_rate);
    const result = await this.prisma.$transaction(async (tx) => {
       
      const application = await tx.installmentApplication.create({
        data: {
          user_id: userId,
          order_id: orderId,
          plan_id: planId,
          status: 'approved', 
          total_amount: orderTotal,
          loan_amount: orderTotal,
          monthly_payment: monthlyPayment,
        }
      });

      const schedulesData = [];
      for (let i = 1; i <= plan.duration_months; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i); 

        schedulesData.push({
          application_id: application.id,
          due_date: dueDate,
          amount_due: monthlyPayment,
          status: 'unpaid'
        });
      }

      await tx.installmentSchedule.createMany({
        data: schedulesData
      });

      return application;
    });

    return {
      message: 'Đăng ký trả góp thành công và đã tạo lịch thanh toán!',
      applicationDetails: result
    };
  }
}