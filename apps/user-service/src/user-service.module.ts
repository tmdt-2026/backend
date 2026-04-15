import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddressesModule } from './addresses/addresses.module';
import { FcmModule } from './fcm/fcm.module';
import { InternalModule } from './internal/internal.module';
import { PublishersModule } from './publishers/publishers.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggerService } from './common/logger/logger.service';
import { appConfig } from './config/app.config';
import { jwtConfig } from './config/jwt.config';
import { bcryptConfig } from './config/bcrypt.config';
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
      load: [appConfig, jwtConfig, bcryptConfig, rabbitmqConfig],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
    PrismaModule,
    PublishersModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    FcmModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [
    LoggerService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class UserServiceModule {}
