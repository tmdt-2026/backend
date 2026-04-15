import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommentsModule } from './comments/comments.module';
import { InternalModule } from './internal/internal.module';
import { PublishersModule } from './publishers/publishers.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/app.config';
import { jwtConfig } from './config/jwt.config';
import { rabbitmqConfig } from './config/rabbitmq.config';
import { rpcConfig } from './config/rpc.config';

const rootEnvPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
].find((path) => existsSync(path));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
      load: [appConfig, jwtConfig, rabbitmqConfig, rpcConfig],
    }),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'jwt-secret-change-in-production',
        signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRY ?? '15m') as any },
      }),
    }),
    PrismaModule,
    PublishersModule,
    ReviewsModule,
    CommentsModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
