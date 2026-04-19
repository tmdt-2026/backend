import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PaymentController } from './payment-service.controller';
import { PaymentService } from './payment-service.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublishersModule } from './publishers/publishers.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'jwt-secret-change-in-production',
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRY ?? '15m' },
    }),
    PublishersModule,
  ],
  controllers: [PaymentController, HealthController],
  providers: [
    PaymentService,
    PrismaService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class PaymentModule {}
