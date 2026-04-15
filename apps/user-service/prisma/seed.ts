import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/user-client';

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
  admin: '11111111-1111-1111-1111-111111111111',
  staff: '22222222-2222-2222-2222-222222222222',
  customer: '33333333-3333-3333-3333-333333333333',
} as const;

const PASSWORD = 'Password123';

async function main() {
  console.log('Seeding user-service...');

  const roles = ['admin', 'staff', 'customer'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { id: idsByRole(name), name },
    });
    console.log(`  role ${name} ready`);
  }

  const hashPassword = await bcrypt.hash(PASSWORD, 10);

  const userData = [
    {
      id: IDS.admin,
      email: 'admin@tmdt.local',
      userName: 'admin',
      phoneNumber: '0900000001',
      fullName: 'System Admin',
      roles: ['admin'],
    },
    {
      id: IDS.staff,
      email: 'staff@tmdt.local',
      userName: 'staff01',
      phoneNumber: '0900000002',
      fullName: 'Store Staff',
      roles: ['staff'],
    },
    {
      id: IDS.customer,
      email: 'customer@tmdt.local',
      userName: 'customer01',
      phoneNumber: '0900000003',
      fullName: 'Test Customer',
      roles: ['customer'],
    },
  ];

  for (const u of userData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        userName: u.userName,
        hashPassword,
        phoneNumber: u.phoneNumber,
        isActive: true,
      },
      create: {
        id: u.id,
        userName: u.userName,
        hashPassword,
        email: u.email,
        phoneNumber: u.phoneNumber,
        isActive: true,
      },
    });

    await prisma.userDetail.upsert({
      where: { userId: user.id },
      update: {
        fullName: u.fullName,
        avatarUrl: null,
      },
      create: {
        userId: user.id,
        fullName: u.fullName,
      },
    });

    const roleIds = await prisma.role.findMany({
      where: { name: { in: u.roles } },
      select: { id: true },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.createMany({
      data: roleIds.map((r) => ({ userId: user.id, roleId: r.id })),
      skipDuplicates: true,
    });

    await prisma.userAddress.deleteMany({ where: { userId: user.id } });
    await prisma.userAddress.create({
      data: {
        userId: user.id,
        label: 'Home',
        fullName: u.fullName,
        phoneNumber: u.phoneNumber,
        province: 'Ho Chi Minh',
        district: 'District 1',
        ward: 'Ben Nghe',
        street: '1 Le Loi',
        isDefault: true,
      },
    });

    await prisma.fcmToken.upsert({
      where: { token: `fcm-token-${u.userName}` },
      update: { deviceType: 'android' },
      create: {
        userId: user.id,
        token: `fcm-token-${u.userName}`,
        deviceType: 'android',
      },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    console.log(`  user ${u.email} ready`);
  }

  console.log('Seed complete. Test password: Password123');
}

function idsByRole(name: string): string {
  if (name === 'admin') return 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if (name === 'staff') return 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  return 'cccccccc-cccc-cccc-cccc-cccccccccccc';
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
