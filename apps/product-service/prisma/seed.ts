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
  categoryIpad: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  modelIphone16Pro: '66666666-6666-6666-6666-666666666666',
  modelIphone16: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  modelIpadAirM2: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  productIphone16Pro: '77777777-7777-7777-7777-777777777777',
  productIphone16: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  productIpadAirM2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  variantIphone16Pro256: '88888888-8888-8888-8888-888888888888',
  variantIphone16Pro512: '99999999-9999-9999-9999-999999999999',
  variantIphone16Blue128: '12121212-1212-4121-8121-121212121212',
  variantIphone16Pink256: '13131313-1313-4131-8131-131313131313',
  variantIpadAirM2Wifi128: '14141414-1414-4141-8141-141414141414',
  variantIpadAirM2Cellular256: '15151515-1515-4151-8151-151515151515',
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

  const ipad = await prisma.category.upsert({
    where: { slug: 'ipad' },
    update: { name: 'iPad', parentId: phones.id, isActive: true, sortOrder: 2 },
    create: {
      id: IDS.categoryIpad,
      name: 'iPad',
      slug: 'ipad',
      parentId: phones.id,
      sortOrder: 2,
      isActive: true,
    },
  });

  const modelIphone16Pro = await prisma.model.upsert({
    where: { id: IDS.modelIphone16Pro },
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
      id: IDS.modelIphone16Pro,
      modelName: 'iPhone 16 Pro',
      modelNumber: 'A3293',
      brand: 'Apple',
      cpu: 'A18 Pro',
      operaSystem: 'iOS 18',
      isActive: true,
    },
  });

  const modelIphone16 = await prisma.model.upsert({
    where: { id: IDS.modelIphone16 },
    update: {
      modelName: 'iPhone 16',
      modelNumber: 'A3287',
      brand: 'Apple',
      cpu: 'A18',
      operaSystem: 'iOS 18',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.modelIphone16,
      modelName: 'iPhone 16',
      modelNumber: 'A3287',
      brand: 'Apple',
      cpu: 'A18',
      operaSystem: 'iOS 18',
      isActive: true,
    },
  });

  const modelIpadAirM2 = await prisma.model.upsert({
    where: { id: IDS.modelIpadAirM2 },
    update: {
      modelName: 'iPad Air M2',
      modelNumber: 'A2898',
      brand: 'Apple',
      cpu: 'Apple M2',
      operaSystem: 'iPadOS 18',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.modelIpadAirM2,
      modelName: 'iPad Air M2',
      modelNumber: 'A2898',
      brand: 'Apple',
      cpu: 'Apple M2',
      operaSystem: 'iPadOS 18',
      isActive: true,
    },
  });

  const productIphone16Pro = await prisma.product.upsert({
    where: { id: IDS.productIphone16Pro },
    update: {
      name: 'iPhone 16 Pro',
      modelId: modelIphone16Pro.id,
      categoryId: iphone.id,
      imgUrl: 'https://cdn.example.com/products/iphone-16-pro.jpg',
      description: 'Flagship product for integration tests',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.productIphone16Pro,
      name: 'iPhone 16 Pro',
      modelId: modelIphone16Pro.id,
      categoryId: iphone.id,
      imgUrl: 'https://cdn.example.com/products/iphone-16-pro.jpg',
      description: 'Flagship product for integration tests',
      isActive: true,
    },
  });

  const productIphone16 = await prisma.product.upsert({
    where: { id: IDS.productIphone16 },
    update: {
      name: 'iPhone 16',
      modelId: modelIphone16.id,
      categoryId: iphone.id,
      imgUrl: 'https://cdn.example.com/products/iphone-16.jpg',
      description: 'Mainstream iPhone sample for API testing',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.productIphone16,
      name: 'iPhone 16',
      modelId: modelIphone16.id,
      categoryId: iphone.id,
      imgUrl: 'https://cdn.example.com/products/iphone-16.jpg',
      description: 'Mainstream iPhone sample for API testing',
      isActive: true,
    },
  });

  const productIpadAirM2 = await prisma.product.upsert({
    where: { id: IDS.productIpadAirM2 },
    update: {
      name: 'iPad Air M2',
      modelId: modelIpadAirM2.id,
      categoryId: ipad.id,
      imgUrl: 'https://cdn.example.com/products/ipad-air-m2.jpg',
      description: 'Tablet sample for cross-service testing',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.productIpadAirM2,
      name: 'iPad Air M2',
      modelId: modelIpadAirM2.id,
      categoryId: ipad.id,
      imgUrl: 'https://cdn.example.com/products/ipad-air-m2.jpg',
      description: 'Tablet sample for cross-service testing',
      isActive: true,
    },
  });

  const productIds = [
    productIphone16Pro.id,
    productIphone16.id,
    productIpadAirM2.id,
  ];

  await prisma.productImage.deleteMany({
    where: { productId: { in: productIds } },
  });

  await prisma.productImage.createMany({
    data: [
      {
        productId: productIphone16Pro.id,
        imageUrl: 'https://cdn.example.com/products/iphone-16-pro-front.jpg',
        altText: 'iPhone 16 Pro front view',
        sortOrder: 1,
      },
      {
        productId: productIphone16Pro.id,
        imageUrl: 'https://cdn.example.com/products/iphone-16-pro-back.jpg',
        altText: 'iPhone 16 Pro back view',
        sortOrder: 2,
      },
      {
        productId: productIphone16.id,
        imageUrl: 'https://cdn.example.com/products/iphone-16-blue-front.jpg',
        altText: 'iPhone 16 blue front view',
        sortOrder: 1,
      },
      {
        productId: productIphone16.id,
        imageUrl: 'https://cdn.example.com/products/iphone-16-blue-back.jpg',
        altText: 'iPhone 16 blue back view',
        sortOrder: 2,
      },
      {
        productId: productIpadAirM2.id,
        imageUrl: 'https://cdn.example.com/products/ipad-air-m2-starlight-front.jpg',
        altText: 'iPad Air M2 front view',
        sortOrder: 1,
      },
      {
        productId: productIpadAirM2.id,
        imageUrl: 'https://cdn.example.com/products/ipad-air-m2-starlight-back.jpg',
        altText: 'iPad Air M2 back view',
        sortOrder: 2,
      },
    ],
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variantIphone16Pro256 },
    update: {
      productId: productIphone16Pro.id,
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
      id: IDS.variantIphone16Pro256,
      productId: productIphone16Pro.id,
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
    where: { id: IDS.variantIphone16Pro512 },
    update: {
      productId: productIphone16Pro.id,
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
      id: IDS.variantIphone16Pro512,
      productId: productIphone16Pro.id,
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

  await prisma.productVariant.upsert({
    where: { id: IDS.variantIphone16Blue128 },
    update: {
      productId: productIphone16.id,
      color: 'Ultramarine',
      ram: 8,
      storage: 128,
      importPrice: 18000000,
      originalPrice: 24990000,
      price: 22990000,
      stockQuantity: 35,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.variantIphone16Blue128,
      productId: productIphone16.id,
      color: 'Ultramarine',
      ram: 8,
      storage: 128,
      importPrice: 18000000,
      originalPrice: 24990000,
      price: 22990000,
      stockQuantity: 35,
      isActive: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variantIphone16Pink256 },
    update: {
      productId: productIphone16.id,
      color: 'Pink',
      ram: 8,
      storage: 256,
      importPrice: 20000000,
      originalPrice: 27990000,
      price: 25990000,
      stockQuantity: 22,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.variantIphone16Pink256,
      productId: productIphone16.id,
      color: 'Pink',
      ram: 8,
      storage: 256,
      importPrice: 20000000,
      originalPrice: 27990000,
      price: 25990000,
      stockQuantity: 22,
      isActive: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variantIpadAirM2Wifi128 },
    update: {
      productId: productIpadAirM2.id,
      color: 'Starlight',
      ram: 8,
      storage: 128,
      importPrice: 14000000,
      originalPrice: 17990000,
      price: 16990000,
      stockQuantity: 18,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.variantIpadAirM2Wifi128,
      productId: productIpadAirM2.id,
      color: 'Starlight',
      ram: 8,
      storage: 128,
      importPrice: 14000000,
      originalPrice: 17990000,
      price: 16990000,
      stockQuantity: 18,
      isActive: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: IDS.variantIpadAirM2Cellular256 },
    update: {
      productId: productIpadAirM2.id,
      color: 'Space Gray',
      ram: 8,
      storage: 256,
      importPrice: 17500000,
      originalPrice: 21990000,
      price: 20990000,
      stockQuantity: 12,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: IDS.variantIpadAirM2Cellular256,
      productId: productIpadAirM2.id,
      color: 'Space Gray',
      ram: 8,
      storage: 256,
      importPrice: 17500000,
      originalPrice: 21990000,
      price: 20990000,
      stockQuantity: 12,
      isActive: true,
    },
  });

  const variantIds = [
    IDS.variantIphone16Pro256,
    IDS.variantIphone16Pro512,
    IDS.variantIphone16Blue128,
    IDS.variantIphone16Pink256,
    IDS.variantIpadAirM2Wifi128,
    IDS.variantIpadAirM2Cellular256,
  ];

  await prisma.priceHistory.deleteMany({
    where: { productVariantId: { in: variantIds } },
  });

  await prisma.priceHistory.createMany({
    data: [
      {
        productVariantId: IDS.variantIphone16Pro256,
        changedBy: IDS.adminUserId,
        oldPrice: 30990000,
        newPrice: 29990000,
        reason: 'Launch promotion',
      },
      {
        productVariantId: IDS.variantIphone16Pro512,
        changedBy: IDS.adminUserId,
        oldPrice: 36990000,
        newPrice: 35990000,
        reason: 'Launch promotion',
      },
      {
        productVariantId: IDS.variantIphone16Blue128,
        changedBy: IDS.adminUserId,
        oldPrice: 23990000,
        newPrice: 22990000,
        reason: 'Seasonal campaign',
      },
      {
        productVariantId: IDS.variantIphone16Pink256,
        changedBy: IDS.adminUserId,
        oldPrice: 26990000,
        newPrice: 25990000,
        reason: 'Seasonal campaign',
      },
      {
        productVariantId: IDS.variantIpadAirM2Wifi128,
        changedBy: IDS.adminUserId,
        oldPrice: 17490000,
        newPrice: 16990000,
        reason: 'Back to school discount',
      },
      {
        productVariantId: IDS.variantIpadAirM2Cellular256,
        changedBy: IDS.adminUserId,
        oldPrice: 21490000,
        newPrice: 20990000,
        reason: 'Back to school discount',
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
