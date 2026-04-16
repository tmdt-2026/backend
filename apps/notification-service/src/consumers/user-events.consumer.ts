import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';

interface UserRegisteredPayload {
  userId: string;
  email: string;
  userName: string;
  loginUrl?: string;
}

interface UserPasswordResetPayload {
  userId: string;
  email: string;
  userName: string;
  resetUrl: string;
  expiresIn?: string;
}

interface UserAccountLockedPayload {
  userId: string;
  email: string;
  userName: string;
}

@Controller()
export class UserEventsConsumer {
  private readonly logger = new Logger(UserEventsConsumer.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('user.registered')
  async handleUserRegistered(@Payload() payload: UserRegisteredPayload): Promise<void> {
    this.logger.log(`Handling user.registered for user: ${payload.userId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'user_registered',
        toEmail: payload.email,
        toName: payload.userName,
        variables: {
          userName: payload.userName,
          email: payload.email,
          loginUrl: payload.loginUrl ?? process.env.FRONTEND_URL ?? 'https://iluxury.vn/login',
        },
        referenceType: 'user',
        referenceId: payload.userId,
      });
    } catch (err: any) {
      this.logger.error(`Failed to handle user.registered ${payload.userId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('user.password_reset')
  async handlePasswordReset(@Payload() payload: UserPasswordResetPayload): Promise<void> {
    this.logger.log(`Handling user.password_reset for user: ${payload.userId}`);
    try {
      await this.notificationService.sendEmail({
        templateKey: 'password_reset',
        toEmail: payload.email,
        toName: payload.userName,
        variables: {
          userName: payload.userName,
          resetUrl: payload.resetUrl,
          expiresIn: payload.expiresIn ?? '15 phút',
        },
        referenceType: 'user',
        referenceId: payload.userId,
      });
    } catch (err: any) {
      this.logger.error(`Failed to handle user.password_reset ${payload.userId}: ${err.message}`);
      throw err;
    }
  }

  @EventPattern('user.account_locked')
  async handleAccountLocked(@Payload() payload: UserAccountLockedPayload): Promise<void> {
    this.logger.log(`Handling user.account_locked for user: ${payload.userId}`);
    // No template defined for this event yet — log and skip
    this.logger.warn(`No template for user.account_locked, skipping email for ${payload.userId}`);
  }
}
