import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'promotion-service',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'error',
        service: 'promotion-service',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
