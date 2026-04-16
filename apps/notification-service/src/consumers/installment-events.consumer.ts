import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';

interface InstallmentApprovedPayload {
  applicationId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  planName: string;
  monthlyPayment: string;
  totalMonths: number;
  firstDueDate: string;
  scheduleUrl: string;
}

interface InstallmentRejectedPayload {
  applicationId: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  rejectReason: string;
  supportUrl: string;
}

interface InstallmentReminderPayload {
  applicationId: string;
  scheduleId: string;
  userEmail: string;
  userName: string;
  orderCode: string;
  termNumber: number;
  amountDue: string;
  dueDate: string;
  paymentUrl: string;
}

interface InstallmentOverduePayload {
  applicationId: string;
  scheduleId: string;
  userEmail: string;
  userName: string;
  orderCode: string;
  termNumber: number;
  amountDue: string;
  dueDate: string;
  lateFee: string;
  paymentUrl: string;
}

@Controller()
export class InstallmentEventsConsumer {
  private readonly logger = new Logger(InstallmentEventsConsumer.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('installment.approved')
  async handleInstallmentApproved(@Payload() payload: InstallmentApprovedPayload): Promise<void> {
    this.logger.log(`Handling installment.approved for application: ${payload.applicationId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'installment_approved',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'installment',
        referenceId: payload.applicationId,
      });
    } catch (err: any) {
      this.logger.error(`Failed installment.approved ${payload.applicationId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('installment.rejected')
  async handleInstallmentRejected(@Payload() payload: InstallmentRejectedPayload): Promise<void> {
    this.logger.log(`Handling installment.rejected for application: ${payload.applicationId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'installment_rejected',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'installment',
        referenceId: payload.applicationId,
      });
    } catch (err: any) {
      this.logger.error(`Failed installment.rejected ${payload.applicationId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('installment.reminder')
  async handleInstallmentReminder(@Payload() payload: InstallmentReminderPayload): Promise<void> {
    this.logger.log(`Handling installment.reminder for schedule: ${payload.scheduleId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'installment_reminder',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'installment',
        referenceId: payload.scheduleId,
      });
    } catch (err: any) {
      this.logger.error(`Failed installment.reminder ${payload.scheduleId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('installment.overdue')
  async handleInstallmentOverdue(@Payload() payload: InstallmentOverduePayload): Promise<void> {
    this.logger.log(`Handling installment.overdue for schedule: ${payload.scheduleId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'installment_overdue',
        toEmail: payload.userEmail,
        toName: payload.userName,
        variables: payload as unknown as Record<string, unknown>,
        referenceType: 'installment',
        referenceId: payload.scheduleId,
      });
    } catch (err: any) {
      this.logger.error(`Failed installment.overdue ${payload.scheduleId}: ${err.message}`);
      throw err;
    }
  }
}
