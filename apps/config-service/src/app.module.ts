import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { PublishersModule } from './publishers/publishers.module';
import { SettingsModule } from './settings/settings.module';
import { BannersModule } from './banners/banners.module';
import { InternalModule } from './internal/internal.module';
import { TasksModule } from './tasks/tasks.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HealthController } from './health/health.controller';

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
    }),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'jwt-secret-change-in-production',
        signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRY ?? '15m') as any },
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    PublishersModule,
    SettingsModule,
    BannersModule,
    InternalModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
