import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PromotionController } from './promotion/promotion.controller';
import { PromotionMicroserviceController } from './promotion/promotion-microservice.controller';
import { PromotionService } from './promotion/promotion.service';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';
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
  ],
  controllers: [PromotionController, PromotionMicroserviceController, HealthController],
  providers: [
    PromotionService,
    PrismaService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
