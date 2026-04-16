import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT ?? '587', 10),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER ?? '',
  pass: process.env.MAIL_PASS ?? '',
  from: process.env.MAIL_FROM ?? 'no-reply@iluxury.vn',
  fromName: process.env.MAIL_FROM_NAME ?? 'iLuxury',
  maxAttempts: parseInt(process.env.MAIL_MAX_ATTEMPTS ?? '3', 10),
  retryDelay1: parseInt(process.env.MAIL_RETRY_DELAY_1 ?? '30000', 10),
  retryDelay2: parseInt(process.env.MAIL_RETRY_DELAY_2 ?? '120000', 10),
  poolMaxConnections: parseInt(process.env.MAIL_POOL_MAX_CONNECTIONS ?? '5', 10),
  rateLimit: parseInt(process.env.MAIL_RATE_LIMIT ?? '10', 10),
}));
