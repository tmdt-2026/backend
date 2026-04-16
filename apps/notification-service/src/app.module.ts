import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { NotificationModule } from './notification/notification.module';
import { TemplatesModule } from './templates/templates.module';
import { EmailLogsModule } from './email-logs/email-logs.module';
import { ConsumersModule } from './consumers/consumers.module';
import { InternalModule } from './internal/internal.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/app.config';
import { mailConfig } from './config/mail.config';
import { rabbitmqConfig } from './config/rabbitmq.config';

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
      load: [appConfig, mailConfig, rabbitmqConfig],
    }),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'jwt-secret-change-in-production',
        signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRY ?? '15m') as any },
      }),
    }),
    PrismaModule,
    MailerModule,
    NotificationModule,
    TemplatesModule,
    EmailLogsModule,
    ConsumersModule,
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
