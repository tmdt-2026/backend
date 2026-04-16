import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/promotion-client';

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
  promoFreeShip: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  promoFirstOrder: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  promoSummerSale: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  promoFlashSale: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  promoMember: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
} as const;

async function main() {
  console.log('🌱 Seeding promotion-service...');

  // 1. Voucher miễn phí vận chuyển
  await prisma.promotion.upsert({
    where: { code: 'FREESHIP' },
    update: { isActive: true },
    create: {
      id: IDS.promoFreeShip,
      code: 'FREESHIP',
      name: 'Miễn phí vận chuyển toàn quốc',
      description: 'Áp dụng cho đơn hàng từ 500.000đ trở lên',
      discountType: 'FIXED_AMOUNT',
      discountValue: 30000,
      maxDiscount: null,
      minOrderValue: 500000,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2027-12-31'),
      usageLimit: 5000,
      perUserLimit: 3,
      isActive: true,
    },
  });

  // 2. Voucher giảm 20% cho đơn hàng đầu tiên
  await prisma.promotion.upsert({
    where: { code: 'FIRST20' },
    update: { isActive: true },
    create: {
      id: IDS.promoFirstOrder,
      code: 'FIRST20',
      name: 'Giảm 20% cho đơn hàng đầu tiên',
      description: 'Giảm tối đa 150.000đ cho khách hàng mới',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxDiscount: 150000,
      minOrderValue: 200000,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 1000,
      perUserLimit: 1,
      isActive: true,
    },
  });

  // 3. Khuyến mãi hè 2026
  await prisma.promotion.upsert({
    where: { code: 'SUMMER26' },
    update: { isActive: true },
    create: {
      id: IDS.promoSummerSale,
      code: 'SUMMER26',
      name: 'Siêu sale hè 2026',
      description: 'Giảm 15% tất cả sản phẩm điện thoại và phụ kiện',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxDiscount: 500000,
      minOrderValue: 100000,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-08-31'),
      usageLimit: 3000,
      perUserLimit: 2,
      isActive: true,
    },
  });

  // 4. Flash Sale (giảm mạnh trong thời gian ngắn)
  await prisma.promotion.upsert({
    where: { code: 'FLASH50' },
    update: { isActive: true },
    create: {
      id: IDS.promoFlashSale,
      code: 'FLASH50',
      name: 'Flash Sale - Giảm 50%',
      description: 'Chỉ áp dụng trong 48 giờ',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscount: 1000000,
      minOrderValue: 500000,
      startDate: new Date('2026-04-20'),
      endDate: new Date('2026-04-22'),
      usageLimit: 500,
      perUserLimit: 1,
      isActive: true,
    },
  });

  // 5. Voucher dành cho thành viên VIP
  await prisma.promotion.upsert({
    where: { code: 'VIP10' },
    update: { isActive: true },
    create: {
      id: IDS.promoMember,
      code: 'VIP10',
      name: 'Ưu đãi thành viên VIP',
      description: 'Giảm thêm 10% cho thành viên VIP',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 300000,
      minOrderValue: 0,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2027-12-31'),
      usageLimit: null,
      perUserLimit: null,
      isActive: true,
    },
  });

  console.log('✅ Promotion seed completed successfully!');
  console.log(`   → Created ${Object.keys(IDS).length} sample promotions`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });