import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.REVIEW_SERVICE_PORT ?? process.env.PORT ?? '3002', 10),
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  commentEditWindowMs: parseInt(process.env.COMMENT_EDIT_WINDOW_MINUTES ?? '15', 10) * 60 * 1000,
  maxReviewImages: parseInt(process.env.MAX_REVIEW_IMAGES ?? '5', 10),
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB ?? '5', 10),
}));
