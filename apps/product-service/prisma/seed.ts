import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/product-client';

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
  categoryPhones: '44444444-4444-4444-4444-444444444444',
  categoryIPhone: '55555555-5555-5555-5555-555555555555',
  modelIphone16: '66666666-6666-6666-6666-666666666666',
  productIphone16: '77777777-7777-7777-7777-777777777777',
  variant256: '88888888-8888-8888-8888-888888888888',
  variant512: '99999999-9999-9999-9999-999999999999',
  adminUserId: '11111111-1111-1111-1111-111111111111',
} as const;

async function main() {
  console.log('Seeding product-service...');

  const phones = await prisma.category.upsert({
    where: { slug: 'phones' },
    update: { name: 'Phones', isActive: true, sortOrder: 1 },
    create: {
      id: IDS.categoryPhones,
      name: 'Phones',
      slug: 'phones',
      sortOrder: 1,
      isActive: true,
    },
  });

  const iphone = await prisma.category.upsert({
    where: { slug: 'iphone' },
    update: { name: 'iPhone', parentId: phones.id, isActive: true, sortOrder: 1 },
    create: {
      id: IDS.categoryIPhone,
      name: 'iPhone',
      slug: 'iphone',
      parentId: phones.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  const model = await prisma.model.upsert({
    where: { id: IDS.modelIphone16 },
    update: {
      modelName: 'iPhone 16 Pro',
      modelNumber: 'A3293',
      brand: 'Apple',
      cpu: 'A18 Pro',
      operaSystem: 'iOS 18',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.modelIphone16,
      modelName: 'iPhone 16 Pro',
      modelNumber: 'A3293',
      brand: 'Apple',
      cpu: 'A18 Pro',
      operaSystem: 'iOS 18',
      isActive: true,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: IDS.productIphone16 },
    update: {
      name: 'iPhone 16 Pro',
      modelId: model.id,
      categoryId: iphone.id,
      imgUrl: 'https://cdn.example.com/products/iphone-16-pro.jpg',
      description: 'Seed product for integration testing',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.productIphone16,
      name: 'iPhone 16 Pro',
      modelId: model.id,
      categoryId: iphone.id,
      imgUrl: 'https://cdn.example.com/products/iphone-16-pro.jpg',
      description: 'Seed product for integration testing',
      isActive: true,
    },
  });

  await prisma.productImage.deleteMany({ where: { productId: product.id } });
  await prisma.productImage.createMany({
    data: [
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/products/iphone-16-pro-front.jpg',
        altText: 'Front view',
        sortOrder: 1,
      },
      {
        productId: product.id,
        imageUrl: 'https://cdn.example.com/products/iphone-16-pro-back.jpg',
        altText: 'Back view',
        sortOrder: 2,
      },
    ],
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variant256 },
    update: {
      productId: product.id,
      color: 'Natural Titanium',
      ram: 8,
      storage: 256,
      importPrice: 25000000,
      originalPrice: 32990000,
      price: 29990000,
      stockQuantity: 20,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.variant256,
      productId: product.id,
      color: 'Natural Titanium',
      ram: 8,
      storage: 256,
      importPrice: 25000000,
      originalPrice: 32990000,
      price: 29990000,
      stockQuantity: 20,
      isActive: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variant512 },
    update: {
      productId: product.id,
      color: 'Black Titanium',
      ram: 8,
      storage: 512,
      importPrice: 29000000,
      originalPrice: 38990000,
      price: 35990000,
      stockQuantity: 10,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.variant512,
      productId: product.id,
      color: 'Black Titanium',
      ram: 8,
      storage: 512,
      importPrice: 29000000,
      originalPrice: 38990000,
      price: 35990000,
      stockQuantity: 10,
      isActive: true,
    },
  });

  await prisma.priceHistory.deleteMany({
    where: { productVariantId: { in: [IDS.variant256, IDS.variant512] } },
  });

  await prisma.priceHistory.createMany({
    data: [
      {
        productVariantId: IDS.variant256,
        changedBy: IDS.adminUserId,
        oldPrice: 30990000,
        newPrice: 29990000,
        reason: 'Launch promotion',
      },
      {
        productVariantId: IDS.variant512,
        changedBy: IDS.adminUserId,
        oldPrice: 36990000,
        newPrice: 35990000,
        reason: 'Launch promotion',
      },
    ],
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
