import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, SettingType } from '@prisma/config-client';

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
  bannerMain: 'eeee1111-1111-1111-1111-111111111111',
  bannerSub: 'eeee2222-2222-2222-2222-222222222222',
  adminUserId: '11111111-1111-1111-1111-111111111111',
} as const;

async function main() {
  console.log('Seeding config-service...');

  const settings = [
    {
      key: 'site_name',
      value: 'TMDT Shop',
      type: SettingType.string,
      group: 'general',
      description: 'Store display name',
      isPublic: true,
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      type: SettingType.boolean,
      group: 'general',
      description: 'Maintenance mode flag',
      isPublic: true,
    },
    {
      key: 'shipping_free_threshold',
      value: '500000',
      type: SettingType.number,
      group: 'payment',
      description: 'Free shipping minimum order value',
      isPublic: true,
    },
    {
      key: 'contact_info',
      value: JSON.stringify({ hotline: '19001009', email: 'support@tmdt.local' }),
      type: SettingType.json,
      group: 'contact',
      description: 'Public contact info',
      isPublic: true,
    },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { settingKey: s.key },
      update: {
        settingValue: s.value,
        settingType: s.type,
        group: s.group,
        description: s.description,
        isPublic: s.isPublic,
        updatedBy: IDS.adminUserId,
      },
      create: {
        settingKey: s.key,
        settingValue: s.value,
        settingType: s.type,
        group: s.group,
        description: s.description,
        isPublic: s.isPublic,
        updatedBy: IDS.adminUserId,
      },
    });
  }

  await prisma.banner.upsert({
    where: { id: IDS.bannerMain },
    update: {
      title: 'Summer Sale',
      imageUrl: 'https://cdn.example.com/banners/summer-main.jpg',
      mobileImageUrl: 'https://cdn.example.com/banners/summer-main-mobile.jpg',
      targetUrl: '/products',
      altText: 'Summer sale banner',
      position: 'home_main',
      sortOrder: 1,
      isActive: true,
      createdBy: IDS.adminUserId,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
    },
    create: {
      id: IDS.bannerMain,
      title: 'Summer Sale',
      imageUrl: 'https://cdn.example.com/banners/summer-main.jpg',
      mobileImageUrl: 'https://cdn.example.com/banners/summer-main-mobile.jpg',
      targetUrl: '/products',
      altText: 'Summer sale banner',
      position: 'home_main',
      sortOrder: 1,
      isActive: true,
      createdBy: IDS.adminUserId,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
    },
  });

  await prisma.banner.upsert({
    where: { id: IDS.bannerSub },
    update: {
      title: 'Trade-in Program',
      imageUrl: 'https://cdn.example.com/banners/tradein-sub.jpg',
      mobileImageUrl: 'https://cdn.example.com/banners/tradein-sub-mobile.jpg',
      targetUrl: '/trade-in',
      altText: 'Trade-in banner',
      position: 'home_sub',
      sortOrder: 1,
      isActive: true,
      createdBy: IDS.adminUserId,
    },
    create: {
      id: IDS.bannerSub,
      title: 'Trade-in Program',
      imageUrl: 'https://cdn.example.com/banners/tradein-sub.jpg',
      mobileImageUrl: 'https://cdn.example.com/banners/tradein-sub-mobile.jpg',
      targetUrl: '/trade-in',
      altText: 'Trade-in banner',
      position: 'home_sub',
      sortOrder: 1,
      isActive: true,
      createdBy: IDS.adminUserId,
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
