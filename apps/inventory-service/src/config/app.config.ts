import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.INVENTORY_SERVICE_PORT ?? process.env.PORT ?? '3003', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token',
  lowStockCooldownMs: parseInt(process.env.LOW_STOCK_COOLDOWN_MS ?? '86400000', 10),
}));
