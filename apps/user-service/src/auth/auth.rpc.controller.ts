import { Controller, NotImplementedException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class AuthRpcController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @MessagePattern({ cmd: 'ping' })
  ping(@Payload() payload: Record<string, any> = {}) {
    return {
      ok: true,
      service: 'user-service',
      transport: 'rmq',
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  @MessagePattern({ cmd: 'auth.register' })
  async register(@Payload() dto: RegisterDto) {
    const { tokens, user } = await this.authService.register(dto);
    return { user, ...tokens };
  }

  @MessagePattern({ cmd: 'auth.login' })
  async login(@Payload() dto: LoginDto) {
    const { tokens, user } = await this.authService.login(dto);
    return { user, ...tokens };
  }

  @MessagePattern({ cmd: 'auth.forgot-password' })
  async forgotPassword(@Payload() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If email exists, a password reset link has been sent' };
  }

  @MessagePattern({ cmd: 'auth.reset-password' })
  async resetPassword(@Payload() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  @MessagePattern({ cmd: 'auth.verify-register' })
  verifyRegister() {
    throw new NotImplementedException('auth.verify-register is not implemented in user-service');
  }

  /** Lấy thông tin user theo id — dùng bởi các service khác qua RMQ */
  @MessagePattern({ cmd: 'user.get-by-id' })
  async getUserById(@Payload() payload: { id: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      fullName: user.userDetail?.fullName,
      avatarUrl: user.userDetail?.avatarUrl,
    };
  }

  /** Lấy nhiều user theo danh sách id — dùng bởi các service khác qua RMQ */
  @MessagePattern({ cmd: 'user.batch-get' })
  async batchGetUsers(@Payload() payload: { ids: string[] }) {
    if (!Array.isArray(payload?.ids) || payload.ids.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: payload.ids } },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });
    return users.map((user) => ({
      id: user.id,
      userName: user.userName,
      email: user.email,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      fullName: user.userDetail?.fullName,
      avatarUrl: user.userDetail?.avatarUrl,
    }));
  }
}
