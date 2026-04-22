import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { InstallmentController } from './installment.controller';
import { InstallmentService } from './installment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { PublishersModule } from './publishers/publishers.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'jwt-secret-change-in-production',
      signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRY ?? '15m') as any },
    }),
    PublishersModule,
  ],
  controllers: [InstallmentController],
  providers: [
    InstallmentService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class InstallmentModule {}