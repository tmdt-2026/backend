import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  PrismaClient,
  InventoryTxnType,
  TxnReferenceType,
} from '@prisma/inventory-client';

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
  variant256: '88888888-8888-8888-8888-888888888888',
  variant512: '99999999-9999-9999-9999-999999999999',
} as const;

async function main() {
  console.log('Seeding inventory-service...');

  await prisma.inventory.upsert({
    where: { productVariantId: IDS.variant256 },
    update: {
      quantity: 20,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    },
    create: {
      productVariantId: IDS.variant256,
      quantity: 20,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    },
  });

  await prisma.inventory.upsert({
    where: { productVariantId: IDS.variant512 },
    update: {
      quantity: 10,
      reservedQuantity: 1,
      lowStockThreshold: 3,
    },
    create: {
      productVariantId: IDS.variant512,
      quantity: 10,
      reservedQuantity: 1,
      lowStockThreshold: 3,
    },
  });

  await prisma.inventoryTransaction.deleteMany({
    where: { referenceId: { in: ['SEED-GRN-1', 'SEED-ORD-1'] } },
  });

  await prisma.inventoryTransaction.createMany({
    data: [
      {
        productVariantId: IDS.variant256,
        type: InventoryTxnType.import,
        quantityChange: 20,
        quantityBefore: 0,
        quantityAfter: 20,
        referenceId: 'SEED-GRN-1',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variant256,
        type: InventoryTxnType.reserve,
        quantityChange: -2,
        quantityBefore: 20,
        quantityAfter: 20,
        referenceId: 'SEED-ORD-1',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variant512,
        type: InventoryTxnType.import,
        quantityChange: 10,
        quantityBefore: 0,
        quantityAfter: 10,
        referenceId: 'SEED-GRN-1',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
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
