import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/review-client';

const rootEnvPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
].find((path) => existsSync(path));

if (rootEnvPath) {
  loadEnv({ path: rootEnvPath });
}

const prisma = new PrismaClient();

const IDS = {
  review1: 'aaaa1111-1111-1111-1111-111111111111',
  review2: 'aaaa2222-2222-2222-2222-222222222222',
  commentRoot: 'bbbb1111-1111-1111-1111-111111111111',
  commentReply: 'bbbb2222-2222-2222-2222-222222222222',
  customerUserId: '33333333-3333-3333-3333-333333333333',
  staffUserId: '22222222-2222-2222-2222-222222222222',
  productId: '77777777-7777-7777-7777-777777777777',
} as const;

async function main() {
  console.log('Seeding review-service...');

  await prisma.review.upsert({
    where: {
      userId_productId_orderId: {
        userId: IDS.customerUserId,
        productId: IDS.productId,
        orderId: 'dddd1111-1111-1111-1111-111111111111',
      },
    },
    update: {
      rating: 5,
      content: 'Great phone, battery life is very good.',
      images: ['https://cdn.example.com/reviews/review-1.jpg'],
      isVisible: true,
      userNameSnapshot: 'Test Customer',
      productNameSnapshot: 'iPhone 16 Pro',
    },
    create: {
      id: IDS.review1,
      userId: IDS.customerUserId,
      productId: IDS.productId,
      orderId: 'dddd1111-1111-1111-1111-111111111111',
      rating: 5,
      content: 'Great phone, battery life is very good.',
      images: ['https://cdn.example.com/reviews/review-1.jpg'],
      userNameSnapshot: 'Test Customer',
      productNameSnapshot: 'iPhone 16 Pro',
      isVisible: true,
    },
  });

  await prisma.review.upsert({
    where: {
      userId_productId_orderId: {
        userId: IDS.staffUserId,
        productId: IDS.productId,
        orderId: 'dddd2222-2222-2222-2222-222222222222',
      },
    },
    update: {
      rating: 4,
      content: 'Display quality is excellent.',
      images: [],
      isVisible: true,
      userNameSnapshot: 'Store Staff',
      productNameSnapshot: 'iPhone 16 Pro',
    },
    create: {
      id: IDS.review2,
      userId: IDS.staffUserId,
      productId: IDS.productId,
      orderId: 'dddd2222-2222-2222-2222-222222222222',
      rating: 4,
      content: 'Display quality is excellent.',
      images: [],
      userNameSnapshot: 'Store Staff',
      productNameSnapshot: 'iPhone 16 Pro',
      isVisible: true,
    },
  });

  await prisma.comment.upsert({
    where: { id: IDS.commentRoot },
    update: {
      productId: IDS.productId,
      userId: IDS.customerUserId,
      parentId: null,
      depth: 0,
      content: 'Does this model support eSIM only?',
      isVisible: true,
      userNameSnapshot: 'Test Customer',
      userRoleSnapshot: 'customer',
    },
    create: {
      id: IDS.commentRoot,
      productId: IDS.productId,
      userId: IDS.customerUserId,
      depth: 0,
      content: 'Does this model support eSIM only?',
      isVisible: true,
      userNameSnapshot: 'Test Customer',
      userRoleSnapshot: 'customer',
    },
  });

  await prisma.comment.upsert({
    where: { id: IDS.commentReply },
    update: {
      productId: IDS.productId,
      userId: IDS.staffUserId,
      parentId: IDS.commentRoot,
      depth: 1,
      content: 'It supports both eSIM and nano-SIM.',
      isVisible: true,
      userNameSnapshot: 'Store Staff',
      userRoleSnapshot: 'staff',
    },
    create: {
      id: IDS.commentReply,
      productId: IDS.productId,
      userId: IDS.staffUserId,
      parentId: IDS.commentRoot,
      depth: 1,
      content: 'It supports both eSIM and nano-SIM.',
      isVisible: true,
      userNameSnapshot: 'Store Staff',
      userRoleSnapshot: 'staff',
    },
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
