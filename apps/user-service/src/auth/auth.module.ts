import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthRpcController } from './auth.rpc.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PublishersModule } from '../publishers/publishers.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessExpiry') as any },
      }),
    }),
    PublishersModule,
  ],
  controllers: [AuthController, AuthRpcController],
  providers: [AuthService, TokenService, JwtStrategy, LocalStrategy],
  exports: [AuthService, TokenService, JwtModule],
})
export class AuthModule {}
