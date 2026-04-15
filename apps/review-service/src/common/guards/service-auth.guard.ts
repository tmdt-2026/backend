import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceToken = request.headers['x-service-token'];
    const expectedToken = this.configService.get<string>('app.internalServiceToken');

    if (!serviceToken || serviceToken !== expectedToken) {
      throw new UnauthorizedException('Service token không hợp lệ');
    }
    return true;
  }
}
