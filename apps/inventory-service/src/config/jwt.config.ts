import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'jwt-secret-change-in-production',
  accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
}));
