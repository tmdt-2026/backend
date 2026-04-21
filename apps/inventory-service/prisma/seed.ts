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
  variantIphone16Pro256: '88888888-8888-8888-8888-888888888888',
  variantIphone16Pro512: '99999999-9999-9999-9999-999999999999',
  variantIphone16Blue128: '12121212-1212-4121-8121-121212121212',
  variantIphone16Pink256: '13131313-1313-4131-8131-131313131313',
  variantIpadAirM2Wifi128: '14141414-1414-4141-8141-141414141414',
  variantIpadAirM2Cellular256: '15151515-1515-4151-8151-151515151515',
} as const;

async function main() {
  console.log('Seeding inventory-service...');

  const inventorySeed = [
    {
      productVariantId: IDS.variantIphone16Pro256,
      quantity: 20,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    },
    {
      productVariantId: IDS.variantIphone16Pro512,
      quantity: 10,
      reservedQuantity: 1,
      lowStockThreshold: 3,
    },
    {
      productVariantId: IDS.variantIphone16Blue128,
      quantity: 35,
      reservedQuantity: 4,
      lowStockThreshold: 8,
    },
    {
      productVariantId: IDS.variantIphone16Pink256,
      quantity: 22,
      reservedQuantity: 3,
      lowStockThreshold: 6,
    },
    {
      productVariantId: IDS.variantIpadAirM2Wifi128,
      quantity: 18,
      reservedQuantity: 2,
      lowStockThreshold: 5,
    },
    {
      productVariantId: IDS.variantIpadAirM2Cellular256,
      quantity: 12,
      reservedQuantity: 1,
      lowStockThreshold: 4,
    },
  ] as const;

  for (const item of inventorySeed) {
    await prisma.inventory.upsert({
      where: { productVariantId: item.productVariantId },
      update: {
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        lowStockThreshold: item.lowStockThreshold,
      },
      create: {
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        lowStockThreshold: item.lowStockThreshold,
      },
    });
  }

  await prisma.inventoryTransaction.deleteMany({
    where: {
      referenceId: {
        in: [
          'SEED-GRN-16P-256',
          'SEED-GRN-16P-512',
          'SEED-GRN-16-128',
          'SEED-GRN-16-256',
          'SEED-GRN-IPAD-128',
          'SEED-GRN-IPAD-256',
          'SEED-ORD-16P-256',
          'SEED-ORD-16P-512',
          'SEED-ORD-16-128',
          'SEED-ORD-16-256',
          'SEED-ORD-IPAD-128',
          'SEED-ORD-IPAD-256',
        ],
      },
    },
  });

  await prisma.inventoryTransaction.createMany({
    data: [
      {
        productVariantId: IDS.variantIphone16Pro256,
        type: InventoryTxnType.import,
        quantityChange: 20,
        quantityBefore: 0,
        quantityAfter: 20,
        referenceId: 'SEED-GRN-16P-256',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Pro256,
        type: InventoryTxnType.reserve,
        quantityChange: -2,
        quantityBefore: 20,
        quantityAfter: 20,
        referenceId: 'SEED-ORD-16P-256',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Pro512,
        type: InventoryTxnType.import,
        quantityChange: 10,
        quantityBefore: 0,
        quantityAfter: 10,
        referenceId: 'SEED-GRN-16P-512',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Pro512,
        type: InventoryTxnType.reserve,
        quantityChange: -1,
        quantityBefore: 10,
        quantityAfter: 10,
        referenceId: 'SEED-ORD-16P-512',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Blue128,
        type: InventoryTxnType.import,
        quantityChange: 35,
        quantityBefore: 0,
        quantityAfter: 35,
        referenceId: 'SEED-GRN-16-128',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Blue128,
        type: InventoryTxnType.reserve,
        quantityChange: -4,
        quantityBefore: 35,
        quantityAfter: 35,
        referenceId: 'SEED-ORD-16-128',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Pink256,
        type: InventoryTxnType.import,
        quantityChange: 22,
        quantityBefore: 0,
        quantityAfter: 22,
        referenceId: 'SEED-GRN-16-256',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIphone16Pink256,
        type: InventoryTxnType.reserve,
        quantityChange: -3,
        quantityBefore: 22,
        quantityAfter: 22,
        referenceId: 'SEED-ORD-16-256',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIpadAirM2Wifi128,
        type: InventoryTxnType.import,
        quantityChange: 18,
        quantityBefore: 0,
        quantityAfter: 18,
        referenceId: 'SEED-GRN-IPAD-128',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIpadAirM2Wifi128,
        type: InventoryTxnType.reserve,
        quantityChange: -2,
        quantityBefore: 18,
        quantityAfter: 18,
        referenceId: 'SEED-ORD-IPAD-128',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIpadAirM2Cellular256,
        type: InventoryTxnType.import,
        quantityChange: 12,
        quantityBefore: 0,
        quantityAfter: 12,
        referenceId: 'SEED-GRN-IPAD-256',
        referenceType: TxnReferenceType.import_bill,
        note: 'Initial import from seed',
        createdBy: 'seed-script',
      },
      {
        productVariantId: IDS.variantIpadAirM2Cellular256,
        type: InventoryTxnType.reserve,
        quantityChange: -1,
        quantityBefore: 12,
        quantityAfter: 12,
        referenceId: 'SEED-ORD-IPAD-256',
        referenceType: TxnReferenceType.order,
        note: 'Reserved for test order',
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
