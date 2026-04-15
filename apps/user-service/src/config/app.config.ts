import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.USER_SERVICE_PORT ?? process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token',
}));
