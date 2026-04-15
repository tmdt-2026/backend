import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService, TokenPair } from './token.service';
import { UserPublisher } from '../publishers/user.publisher';
import { PasswordUtil } from '../common/utils/password.util';
import { TokenUtil } from '../common/utils/token.util';
import {
  EmailAlreadyExistsException,
  PhoneAlreadyExistsException,
  InvalidCredentialsException,
  UserInactiveException,
  InvalidResetTokenException,
  InvalidCurrentPasswordException,
  UserNotFoundException,
} from '../common/exceptions';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// In-memory store for password reset tokens (TTL: 15 min)
// In production, replace with Redis
interface ResetTokenEntry {
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly resetTokenStore = new Map<string, ResetTokenEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly publisher: UserPublisher,
  ) { }

  async register(dto: RegisterDto): Promise<{ tokens: TokenPair; user: any }> {
    const email = dto.email.toLowerCase().trim();

    // Check email unique
    const emailExists = await this.prisma.user.findUnique({ where: { email } });
    if (emailExists) throw new EmailAlreadyExistsException();

    // Check phone unique
    if (dto.phoneNumber) {
      const phoneExists = await this.prisma.user.findUnique({
        where: { phoneNumber: dto.phoneNumber },
      });
      if (phoneExists) throw new PhoneAlreadyExistsException();
    }

    // Hash password
    const rounds = this.configService.get<number>('bcrypt.rounds') ?? 12;
    const hashedPassword = await PasswordUtil.hash(dto.password, rounds);

    // Get customer role
    const customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });
    if (!customerRole) throw new Error('Role "customer" not found. Run seed first.');

    // Create user in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          userName: dto.userName,
          email,
          phoneNumber: dto.phoneNumber ?? null,
          hashPassword: hashedPassword,
          userDetail: { create: { fullName: dto.userName } },
          userRoles: { create: { roleId: customerRole.id } },
        },
        include: {
          userDetail: true,
          userRoles: { include: { role: true } },
        },
      });
    });

    const roles = user.userRoles.map((ur) => ur.role.name);
    const tokens = await this.tokenService.issueTokenPair(user.id, roles);

    // Publish event (fire and forget)
    this.publisher
      .publishUserRegistered({
        userId: user.id,
        email: user.email,
        fullName: user.userDetail?.fullName ?? dto.userName,
      })
      .catch(() => { });

    return { tokens, user: this.mapUser(user) };
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) return null;
    const valid = await PasswordUtil.compare(password, user.hashPassword);
    if (!valid) return null;
    return user;
  }

  async login(dto: LoginDto): Promise<{ tokens: TokenPair; user: any }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user) throw new InvalidCredentialsException();

    const valid = await PasswordUtil.compare(dto.password, user.hashPassword);
    if (!valid) throw new InvalidCredentialsException();

    if (!user.isActive) throw new UserInactiveException();

    const roles = user.userRoles.map((ur) => ur.role.name);
    const tokens = await this.tokenService.issueTokenPair(user.id, roles, dto.deviceId);

    return { tokens, user: this.mapUser(user) };
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(rawToken);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.tokenService.revokeToken(rawRefreshToken);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) return; // Silent — do not reveal whether email exists

    const token = TokenUtil.generateResetToken();
    this.resetTokenStore.set(token, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    // Publish event for notification service to send email
    this.publisher
      .publishPasswordReset({
        userId: user.id,
        email: user.email,
        resetToken: token,
      })
      .catch(() => { });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const entry = this.resetTokenStore.get(token);

    if (!entry || entry.expiresAt < new Date()) {
      throw new InvalidResetTokenException();
    }

    const rounds = this.configService.get<number>('bcrypt.rounds') ?? 12;
    const hashedPassword = await PasswordUtil.hash(newPassword, rounds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: entry.userId },
        data: { hashPassword: hashedPassword },
      });
      await tx.refreshToken.updateMany({
        where: { userId: entry.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.resetTokenStore.delete(token);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserNotFoundException();

    const valid = await PasswordUtil.compare(dto.currentPassword, user.hashPassword);
    if (!valid) throw new InvalidCurrentPasswordException();

    const rounds = this.configService.get<number>('bcrypt.rounds') ?? 12;
    const hashedPassword = await PasswordUtil.hash(dto.newPassword, rounds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { hashPassword: hashedPassword },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async validateToken(rawToken: string) {
    // Used by internal endpoints — verifies access token and returns payload
    const { JwtService } = await import('@nestjs/jwt');
    // We just use jwtService from strategy context; this is handled by JwtStrategy
    // This method exists for internal HTTP calls
    return null; // handled by guard
  }

  private mapUser(user: any) {
    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      roles: user.userRoles?.map((ur: any) => ur.role.name) ?? [],
      fullName: user.userDetail?.fullName,
      avatarUrl: user.userDetail?.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
