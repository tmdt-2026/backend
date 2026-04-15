import { registerAs } from '@nestjs/config';

export const rpcConfig = registerAs('rpc', () => ({
  orderServiceUrl: process.env.ORDER_SERVICE_URL ?? 'http://order-service:3004',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL ?? 'http://product-service:3001',
  userServiceUrl: process.env.USER_SERVICE_URL ?? 'http://user-service:3000',
  serviceToken: process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token',
  timeoutMs: parseInt(process.env.RPC_TIMEOUT_MS ?? '3000', 10),
}));
