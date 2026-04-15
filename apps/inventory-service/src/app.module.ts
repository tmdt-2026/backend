import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';
import { ConsumersModule } from './consumers/consumers.module';
import { PublishersModule } from './publishers/publishers.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/app.config';
import { jwtConfig } from './config/jwt.config';
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
      load: [appConfig, jwtConfig, rabbitmqConfig],
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
    InventoryModule,
    ConsumersModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
