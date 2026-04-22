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

const categoryIds = {
  mac: '10000000-0000-4000-8000-000000000002',
  airpods: '10000000-0000-4000-8000-000000000003',
  watch: '10000000-0000-4000-8000-000000000004',
  accessories: '10000000-0000-4000-8000-000000000005',
  iphone: '10000000-0000-4000-8000-000000000006',
  ipad: '10000000-0000-4000-8000-000000000007',
} as const;

type CategorySeed = {
  id: string;
  slug: string;
  name: string;
  parentSlug?: keyof typeof categoryIds;
  sortOrder: number;
};

type ModelTemplate = {
  modelName: string;
  tag: string;
};

type VariantTemplate = {
  label: string;
  color?: string;
  ram?: number | null;
  storage?: number | null;
  priceOffset: number;
  stockQuantity: number;
  suffix: string;
};

type CatalogTemplate = {
  slug: keyof typeof categoryIds;
  name: string;
  basePrice: number;
  modelStep: number;
  variantStep: number;
  modelNames: ModelTemplate[];
  variants: VariantTemplate[];
};

const categories: CategorySeed[] = [
  { id: categoryIds.mac, slug: 'mac', name: 'Mac', sortOrder: 1 },
  { id: categoryIds.airpods, slug: 'airpods', name: 'AirPods', sortOrder: 2 },
  { id: categoryIds.watch, slug: 'watch', name: 'Apple Watch', sortOrder: 3 },
  { id: categoryIds.accessories, slug: 'accessories', name: 'Accessories', sortOrder: 4 },
  { id: categoryIds.iphone, slug: 'iphone', name: 'iPhone', sortOrder: 5 },
  { id: categoryIds.ipad, slug: 'ipad', name: 'iPad', sortOrder: 6 },
];

const catalogs: CatalogTemplate[] = [
  {
    slug: 'iphone',
    name: 'iPhone',
    basePrice: 22990000,
    modelStep: 900000,
    variantStep: 250000,
    modelNames: [
      { modelName: 'iPhone 16 Pro Max', tag: '16-pro-max' },
      { modelName: 'iPhone 16 Pro', tag: '16-pro' },
      { modelName: 'iPhone 16 Plus', tag: '16-plus' },
      { modelName: 'iPhone 16', tag: '16' },
      { modelName: 'iPhone 15 Pro Max', tag: '15-pro-max' },
      { modelName: 'iPhone 15 Pro', tag: '15-pro' },
      { modelName: 'iPhone 15 Plus', tag: '15-plus' },
      { modelName: 'iPhone 15', tag: '15' },
      { modelName: 'iPhone 14', tag: '14' },
      { modelName: 'iPhone SE', tag: 'se' },
    ],
    variants: [
      { label: '256GB Natural Titanium', color: 'Natural Titanium', ram: 8, storage: 256, priceOffset: 0, stockQuantity: 24, suffix: 'natural-titanium-256' },
      { label: '512GB Black Titanium', color: 'Black Titanium', ram: 8, storage: 512, priceOffset: 900000, stockQuantity: 18, suffix: 'black-titanium-512' },
      { label: '256GB White Titanium', color: 'White Titanium', ram: 8, storage: 256, priceOffset: 250000, stockQuantity: 22, suffix: 'white-titanium-256' },
      { label: '512GB Desert Titanium', color: 'Desert Titanium', ram: 8, storage: 512, priceOffset: 1100000, stockQuantity: 14, suffix: 'desert-titanium-512' },
      { label: '128GB Ultramarine', color: 'Ultramarine', ram: 8, storage: 128, priceOffset: -1250000, stockQuantity: 30, suffix: 'ultramarine-128' },
      { label: '256GB Teal', color: 'Teal', ram: 8, storage: 256, priceOffset: -100000, stockQuantity: 28, suffix: 'teal-256' },
      { label: '256GB Pink', color: 'Pink', ram: 8, storage: 256, priceOffset: 150000, stockQuantity: 26, suffix: 'pink-256' },
      { label: '1TB Blue Titanium', color: 'Blue Titanium', ram: 8, storage: 1024, priceOffset: 2200000, stockQuantity: 10, suffix: 'blue-titanium-1tb' },
      { label: '128GB Midnight', color: 'Midnight', ram: 6, storage: 128, priceOffset: -1800000, stockQuantity: 32, suffix: 'midnight-128' },
      { label: '256GB Starlight', color: 'Starlight', ram: 6, storage: 256, priceOffset: -900000, stockQuantity: 34, suffix: 'starlight-256' },
    ],
  },
  {
    slug: 'ipad',
    name: 'iPad',
    basePrice: 13990000,
    modelStep: 700000,
    variantStep: 220000,
    modelNames: [
      { modelName: 'iPad Pro 13-inch M4', tag: 'pro-13-m4' },
      { modelName: 'iPad Pro 11-inch M4', tag: 'pro-11-m4' },
      { modelName: 'iPad Air 13-inch M2', tag: 'air-13-m2' },
      { modelName: 'iPad Air 11-inch M2', tag: 'air-11-m2' },
      { modelName: 'iPad 11th Gen', tag: '11th-gen' },
      { modelName: 'iPad 10th Gen', tag: '10th-gen' },
      { modelName: 'iPad mini 7', tag: 'mini-7' },
      { modelName: 'iPad mini 6', tag: 'mini-6' },
      { modelName: 'iPad Pro 12.9-inch M2', tag: 'pro-12-9-m2' },
      { modelName: 'iPad Air 10.9-inch M1', tag: 'air-10-9-m1' },
    ],
    variants: [
      { label: 'Wi-Fi 128GB Space Gray', color: 'Space Gray', ram: 8, storage: 128, priceOffset: 0, stockQuantity: 20, suffix: 'wifi-128-space-gray' },
      { label: 'Wi-Fi 256GB Silver', color: 'Silver', ram: 8, storage: 256, priceOffset: 420000, stockQuantity: 18, suffix: 'wifi-256-silver' },
      { label: 'Wi-Fi 512GB Blue', color: 'Blue', ram: 8, storage: 512, priceOffset: 980000, stockQuantity: 12, suffix: 'wifi-512-blue' },
      { label: 'Wi-Fi + Cellular 256GB Starlight', color: 'Starlight', ram: 8, storage: 256, priceOffset: 650000, stockQuantity: 16, suffix: 'cellular-256-starlight' },
      { label: 'Wi-Fi + Cellular 512GB Purple', color: 'Purple', ram: 8, storage: 512, priceOffset: 1200000, stockQuantity: 10, suffix: 'cellular-512-purple' },
      { label: 'Wi-Fi 128GB Pink', color: 'Pink', ram: 6, storage: 128, priceOffset: -200000, stockQuantity: 24, suffix: 'wifi-128-pink' },
      { label: 'Wi-Fi 256GB Yellow', color: 'Yellow', ram: 6, storage: 256, priceOffset: 220000, stockQuantity: 22, suffix: 'wifi-256-yellow' },
      { label: 'Wi-Fi + Cellular 128GB Green', color: 'Green', ram: 8, storage: 128, priceOffset: 330000, stockQuantity: 14, suffix: 'cellular-128-green' },
      { label: 'Wi-Fi 1TB Space Black', color: 'Space Black', ram: 16, storage: 1024, priceOffset: 1650000, stockQuantity: 8, suffix: 'wifi-1tb-space-black' },
      { label: 'Wi-Fi + Cellular 1TB Silver', color: 'Silver', ram: 16, storage: 1024, priceOffset: 2100000, stockQuantity: 6, suffix: 'cellular-1tb-silver' },
    ],
  },
  {
    slug: 'mac',
    name: 'Mac',
    basePrice: 29990000,
    modelStep: 2000000,
    variantStep: 500000,
    modelNames: [
      { modelName: 'MacBook Pro 16-inch M4 Max', tag: 'mbp-16-m4-max' },
      { modelName: 'MacBook Pro 14-inch M4 Pro', tag: 'mbp-14-m4-pro' },
      { modelName: 'MacBook Air 15-inch M4', tag: 'mba-15-m4' },
      { modelName: 'MacBook Air 13-inch M4', tag: 'mba-13-m4' },
      { modelName: 'iMac 24-inch M4', tag: 'imac-24-m4' },
      { modelName: 'Mac mini M4', tag: 'mac-mini-m4' },
      { modelName: 'Mac Studio M3 Ultra', tag: 'mac-studio-m3-ultra' },
      { modelName: 'Mac Pro M2 Ultra', tag: 'mac-pro-m2-ultra' },
      { modelName: 'MacBook Pro 16-inch M3 Pro', tag: 'mbp-16-m3-pro' },
      { modelName: 'MacBook Air 13-inch M3', tag: 'mba-13-m3' },
    ],
    variants: [
      { label: '8GB 256GB Space Gray', color: 'Space Gray', ram: 8, storage: 256, priceOffset: 0, stockQuantity: 14, suffix: '8gb-256gb-space-gray' },
      { label: '16GB 512GB Silver', color: 'Silver', ram: 16, storage: 512, priceOffset: 1100000, stockQuantity: 12, suffix: '16gb-512gb-silver' },
      { label: '24GB 1TB Midnight', color: 'Midnight', ram: 24, storage: 1024, priceOffset: 2300000, stockQuantity: 8, suffix: '24gb-1tb-midnight' },
      { label: '32GB 1TB Space Black', color: 'Space Black', ram: 32, storage: 1024, priceOffset: 3550000, stockQuantity: 6, suffix: '32gb-1tb-space-black' },
      { label: '16GB 256GB Starlight', color: 'Starlight', ram: 16, storage: 256, priceOffset: 700000, stockQuantity: 15, suffix: '16gb-256gb-starlight' },
      { label: '8GB 512GB Blue', color: 'Blue', ram: 8, storage: 512, priceOffset: 480000, stockQuantity: 11, suffix: '8gb-512gb-blue' },
      { label: '16GB 1TB Silver', color: 'Silver', ram: 16, storage: 1024, priceOffset: 1500000, stockQuantity: 9, suffix: '16gb-1tb-silver' },
      { label: '24GB 2TB Space Gray', color: 'Space Gray', ram: 24, storage: 2048, priceOffset: 4200000, stockQuantity: 5, suffix: '24gb-2tb-space-gray' },
      { label: '32GB 512GB Black', color: 'Black', ram: 32, storage: 512, priceOffset: 2650000, stockQuantity: 7, suffix: '32gb-512gb-black' },
      { label: '8GB 1TB Gold', color: 'Gold', ram: 8, storage: 1024, priceOffset: 1750000, stockQuantity: 10, suffix: '8gb-1tb-gold' },
    ],
  },
  {
    slug: 'airpods',
    name: 'AirPods',
    basePrice: 3990000,
    modelStep: 240000,
    variantStep: 80000,
    modelNames: [
      { modelName: 'AirPods Pro 2', tag: 'pro-2' },
      { modelName: 'AirPods 4', tag: '4' },
      { modelName: 'AirPods Max', tag: 'max' },
      { modelName: 'AirPods 3', tag: '3' },
      { modelName: 'AirPods Pro 3', tag: 'pro-3' },
      { modelName: 'AirPods Max USB-C', tag: 'max-usb-c' },
      { modelName: 'AirPods Pro MagSafe', tag: 'pro-magsafe' },
      { modelName: 'AirPods 2', tag: '2' },
      { modelName: 'AirPods 4 ANC', tag: '4-anc' },
      { modelName: 'AirPods Max Midnight', tag: 'max-midnight' },
    ],
    variants: [
      { label: 'White Standard', color: 'White', priceOffset: 0, stockQuantity: 32, suffix: 'white-standard' },
      { label: 'Midnight Edition', color: 'Midnight', priceOffset: 170000, stockQuantity: 26, suffix: 'midnight-edition' },
      { label: 'Starlight Edition', color: 'Starlight', priceOffset: 130000, stockQuantity: 24, suffix: 'starlight-edition' },
      { label: 'Silver Edition', color: 'Silver', priceOffset: 190000, stockQuantity: 20, suffix: 'silver-edition' },
      { label: 'USB-C Bundle', color: 'White', priceOffset: 240000, stockQuantity: 18, suffix: 'usb-c-bundle' },
      { label: 'MagSafe Bundle', color: 'White', priceOffset: 280000, stockQuantity: 16, suffix: 'magsafe-bundle' },
      { label: 'Travel Case Bundle', color: 'Black', priceOffset: 210000, stockQuantity: 14, suffix: 'travel-case-bundle' },
      { label: 'Night Edition', color: 'Black', priceOffset: 160000, stockQuantity: 22, suffix: 'night-edition' },
      { label: 'Pro Max Bundle', color: 'White', priceOffset: 340000, stockQuantity: 12, suffix: 'pro-max-bundle' },
      { label: 'Studio Bundle', color: 'Space Gray', priceOffset: 420000, stockQuantity: 10, suffix: 'studio-bundle' },
    ],
  },
  {
    slug: 'watch',
    name: 'Apple Watch',
    basePrice: 9990000,
    modelStep: 600000,
    variantStep: 180000,
    modelNames: [
      { modelName: 'Apple Watch Ultra 2 49mm', tag: 'ultra-2-49' },
      { modelName: 'Apple Watch Series 10 46mm', tag: 'series-10-46' },
      { modelName: 'Apple Watch Series 10 42mm', tag: 'series-10-42' },
      { modelName: 'Apple Watch SE 44mm', tag: 'se-44' },
      { modelName: 'Apple Watch SE 40mm', tag: 'se-40' },
      { modelName: 'Apple Watch Ultra 1 49mm', tag: 'ultra-1-49' },
      { modelName: 'Apple Watch Series 9 45mm', tag: 'series-9-45' },
      { modelName: 'Apple Watch Series 9 41mm', tag: 'series-9-41' },
      { modelName: 'Apple Watch Nike 45mm', tag: 'nike-45' },
      { modelName: 'Apple Watch Hermès 45mm', tag: 'hermes-45' },
    ],
    variants: [
      { label: 'Alpine Loop Black', color: 'Black', storage: 64, priceOffset: 0, stockQuantity: 18, suffix: 'alpine-loop-black' },
      { label: 'Ocean Band Blue', color: 'Blue', storage: 64, priceOffset: 180000, stockQuantity: 16, suffix: 'ocean-band-blue' },
      { label: 'Sport Band Red', color: 'Red', storage: 32, priceOffset: -90000, stockQuantity: 22, suffix: 'sport-band-red' },
      { label: 'Milanese Loop Silver', color: 'Silver', storage: 64, priceOffset: 240000, stockQuantity: 14, suffix: 'milanese-loop-silver' },
      { label: 'Trail Loop Green', color: 'Green', storage: 64, priceOffset: 210000, stockQuantity: 15, suffix: 'trail-loop-green' },
      { label: 'Hermes Leather Brown', color: 'Brown', storage: 64, priceOffset: 420000, stockQuantity: 8, suffix: 'hermes-leather-brown' },
      { label: 'Nike Sport Band Black', color: 'Black', storage: 32, priceOffset: 130000, stockQuantity: 20, suffix: 'nike-sport-band-black' },
      { label: 'Titanium Link Gray', color: 'Gray', storage: 64, priceOffset: 310000, stockQuantity: 12, suffix: 'titanium-link-gray' },
      { label: 'Solo Loop Pink', color: 'Pink', storage: 32, priceOffset: 80000, stockQuantity: 24, suffix: 'solo-loop-pink' },
      { label: 'Classic Buckle Tan', color: 'Tan', storage: 32, priceOffset: 150000, stockQuantity: 18, suffix: 'classic-buckle-tan' },
    ],
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    basePrice: 490000,
    modelStep: 70000,
    variantStep: 25000,
    modelNames: [
      { modelName: 'MagSafe Charger', tag: 'magsafe-charger' },
      { modelName: 'USB-C Charge Cable', tag: 'usb-c-cable' },
      { modelName: '20W USB-C Power Adapter', tag: '20w-adapter' },
      { modelName: '35W Dual USB-C Power Adapter', tag: '35w-dual-adapter' },
      { modelName: 'MagSafe Battery Pack', tag: 'battery-pack' },
      { modelName: 'Silicone Case', tag: 'silicone-case' },
      { modelName: 'Leather Case', tag: 'leather-case' },
      { modelName: 'Apple Pencil Pro', tag: 'apple-pencil-pro' },
      { modelName: 'Magic Keyboard', tag: 'magic-keyboard' },
      { modelName: 'AirTag 4-Pack', tag: 'airtag-4-pack' },
      // Thêm các sản phẩm phụ kiện mới
      { modelName: 'Magic Mouse', tag: 'magic-mouse' },
      { modelName: 'Magic Trackpad', tag: 'magic-trackpad' },
      { modelName: 'Apple Polishing Cloth', tag: 'polishing-cloth' },
      { modelName: '240W USB-C Charge Cable', tag: '240w-usb-c-cable' },
      { modelName: '70W USB-C Power Adapter', tag: '70w-adapter' },
      { modelName: '140W USB-C Power Adapter', tag: '140w-adapter' },
      { modelName: 'FineWoven Case', tag: 'finewoven-case' },
      { modelName: 'AirTag Leather Key Ring', tag: 'airtag-leather-key-ring' },
    ],
    variants: [
      { label: 'Standard', color: 'White', priceOffset: 0, stockQuantity: 48, suffix: 'standard' },
      { label: 'USB-C', color: 'White', priceOffset: 15000, stockQuantity: 45, suffix: 'usb-c' },
      { label: 'MagSafe', color: 'White', priceOffset: 25000, stockQuantity: 42, suffix: 'magsafe' },
      { label: 'Braided', color: 'Black', priceOffset: 40000, stockQuantity: 38, suffix: 'braided' },
      { label: 'Travel', color: 'Gray', priceOffset: 60000, stockQuantity: 34, suffix: 'travel' },
      { label: 'Pro', color: 'Silver', priceOffset: 85000, stockQuantity: 30, suffix: 'pro' },
      { label: 'Studio', color: 'Space Gray', priceOffset: 110000, stockQuantity: 26, suffix: 'studio' },
      { label: 'Compact', color: 'White', priceOffset: -10000, stockQuantity: 52, suffix: 'compact' },
      { label: 'Premium', color: 'Tan', priceOffset: 125000, stockQuantity: 22, suffix: 'premium' },
      { label: 'Bundle Pack', color: 'Black', priceOffset: 140000, stockQuantity: 18, suffix: 'bundle-pack' },
    ],
  },
];

// Hàm hỗ trợ lấy ảnh thật từ Unsplash cho từng danh mục
const getRealImageUrl = (slug: string, index: number) => {
  const images = {
    iphone: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
      'https://images.unsplash.com/photo-1530319067432-f2a729c03db5?w=800&q=80',
      'https://images.unsplash.com/photo-1591337676887-a4b7f05e9207?w=800&q=80',
    ],
    ipad: [
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
      'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=800&q=80',
    ],
    mac: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80',
    ],
    airpods: [
      'https://images.unsplash.com/photo-1606220588913-b3aecb4920c9?w=800&q=80',
      'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800&q=80',
    ],
    watch: [
      'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&q=80',
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
    ],
    accessories: [
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',
      'https://images.unsplash.com/photo-1612255369766-eebbfceaf31c?w=800&q=80',
      'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&q=80',
    ],
  };

  const list = images[slug as keyof typeof images] || images.accessories;
  return list[index % list.length];
};

const makeUuid = (value: number) => `20000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function main() {
  console.log('Seeding product-service...');

  const categoryMap = new Map<string, { id: string; slug: string; name: string }>();

  for (const category of categories) {
    const parentId = category.parentSlug ? categoryMap.get(category.parentSlug)?.id : null;

    const result = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        parentId,
        isActive: true,
        sortOrder: category.sortOrder,
      },
      create: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });

    categoryMap.set(category.slug, result);
  }

  const generatedModels: Array<{ id: string; modelName: string }> = [];
  const generatedProducts: Array<{
    id: string;
    modelId: string;
    variantId: string;
    categoryId: string;
    name: string;
    imgUrl: string;
    secondaryImgUrl: string;
    description: string;
    price: number;
    originalPrice: number;
    importPrice: number;
    stockQuantity: number;
    color?: string;
    ram?: number | null;
    storage?: number | null;
  }> = [];

  let sequence = 1;
  const nextId = () => makeUuid(sequence++);

  for (const catalog of catalogs) {
    const category = categoryMap.get(catalog.slug);

    if (!category) {
      throw new Error(`Missing category: ${catalog.slug}`);
    }

    const modelIds = catalog.modelNames.map(() => nextId());

    catalog.modelNames.forEach((model, modelIndex) => {
      const modelId = modelIds[modelIndex];
      generatedModels.push({ id: modelId, modelName: model.modelName });

      catalog.variants.forEach((variant, variantIndex) => {
        const productId = nextId();
        const variantId = nextId();
        const name = `${model.modelName} ${variant.label}`;
        const price = catalog.basePrice + modelIndex * catalog.modelStep + variantIndex * catalog.variantStep + variant.priceOffset;

        generatedProducts.push({
          id: productId,
          modelId,
          variantId,
          categoryId: category.id,
          name,
          imgUrl: getRealImageUrl(catalog.slug, modelIndex + variantIndex), // Dùng ảnh thật
          secondaryImgUrl: getRealImageUrl(catalog.slug, modelIndex + variantIndex + 1),
          description: `${catalog.name} seed product for ${name}.`,
          price,
          originalPrice: Math.round(price * 1.12),
          importPrice: Math.round(price * 0.78),
          stockQuantity: variant.stockQuantity,
          color: variant.color,
          ram: variant.ram ?? null,
          storage: variant.storage ?? null,
        });
      });
    });
  }

  const modelIds = generatedModels.map((item) => item.id);
  const productIds = generatedProducts.map((item) => item.id);
  const variantIds = generatedProducts.map((item) => item.variantId);

  await prisma.priceHistory.deleteMany({
    where: { productVariantId: { in: variantIds } },
  });

  await prisma.productImage.deleteMany({
    where: { productId: { in: productIds } },
  });

  await prisma.productVariant.deleteMany({
    where: { id: { in: variantIds } },
  });

  await prisma.product.deleteMany({
    where: { id: { in: productIds } },
  });

  await prisma.model.deleteMany({
    where: { id: { in: modelIds } },
  });

  await prisma.model.createMany({
    data: generatedModels.map((model) => ({
      id: model.id,
      modelName: model.modelName,
      brand: 'Apple',
      isActive: true,
    })),
  });

  await prisma.product.createMany({
    data: generatedProducts.map((product) => ({
      id: product.id,
      name: product.name,
      modelId: product.modelId,
      categoryId: product.categoryId,
      imgUrl: product.imgUrl,
      description: `${product.description}${product.color ? ` Color: ${product.color}.` : ''}`,
      isActive: true,
    })),
  });

  await prisma.productVariant.createMany({
    data: generatedProducts.map((product) => ({
      id: product.variantId,
      productId: product.id,
      color: product.color,
      ram: product.ram,
      storage: product.storage,
      importPrice: product.importPrice,
      originalPrice: product.originalPrice,
      price: product.price,
      stockQuantity: product.stockQuantity,
      isActive: true,
    })),
  });

  await prisma.productImage.createMany({
    data: generatedProducts.flatMap((product) => {
      return [
        {
          productId: product.id,
          imageUrl: product.imgUrl,
          altText: `${product.name} image 1`,
          sortOrder: 1,
        },
        {
          productId: product.id,
          imageUrl: product.secondaryImgUrl,
          altText: `${product.name} image 2`,
          sortOrder: 2,
        },
      ];
    }),
  });

  await prisma.priceHistory.createMany({
    data: generatedProducts.map((product) => ({
      productVariantId: product.variantId,
      changedBy: '11111111-1111-1111-1111-111111111111',
      oldPrice: Math.round(product.price * 1.04),
      newPrice: product.price,
      reason: 'Expanded seed catalog',
    })),
  });

  console.log(`Seed complete: ${generatedModels.length} models, ${generatedProducts.length} products.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());