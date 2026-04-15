import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    const expected = process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token-change-in-production';
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid service token');
    }
    return true;
  }
}
