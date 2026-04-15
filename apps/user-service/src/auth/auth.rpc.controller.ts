import { Controller, NotImplementedException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller()
export class AuthRpcController {
  constructor(private readonly authService: AuthService) {}

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
}
