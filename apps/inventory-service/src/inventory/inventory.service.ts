import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryPublisher } from '../publishers/inventory.publisher';
import { ImportStockDto } from './dto/import-stock.dto';
import { AdjustmentDto } from './dto/adjustment.dto';
import { BulkCheckDto } from './dto/bulk-check.dto';
import { QueryInventoryDto, QueryTransactionsDto, QueryLowStockDto } from './dto/query-inventory.dto';
import { Prisma, InventoryTxnType, TxnReferenceType } from '@prisma/inventory-client';

export class InsufficientStockException extends HttpException {
  constructor(variantId: string, available: number, requested: number) {
    super(
      { code: 'INSUFFICIENT_STOCK', message: 'Không đủ hàng tồn kho', details: { variantId, available, requested } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class InventoryNotFoundException extends NotFoundException {
  constructor(variantId: string) {
    super({ code: 'INVENTORY_NOT_FOUND', message: `Không tìm thấy tồn kho cho variant: ${variantId}` });
  }
}

export interface OrderItem {
  productVariantId: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  // cooldown map: variantId → timestamp of last stock_low publish
  private readonly stockLowCooldown = new Map<string, number>();
  private readonly cooldownMs = 86400000; // 24h

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: InventoryPublisher,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private mapInventory(inv: any) {
    const available = inv.quantity - inv.reservedQuantity;
    return {
      id: inv.id,
      productVariantId: inv.productVariantId,
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: available,
      lowStockThreshold: inv.lowStockThreshold,
      isLowStock: inv.quantity <= inv.lowStockThreshold,
      updatedAt: inv.updatedAt,
    };
  }

  private async checkAndPublishStockLow(productVariantId: string, quantity: number, threshold: number) {
    if (quantity > threshold) return;
    const lastPublished = this.stockLowCooldown.get(productVariantId) ?? 0;
    if (Date.now() - lastPublished < this.cooldownMs) return;

    this.stockLowCooldown.set(productVariantId, Date.now());
    await this.publisher.publishStockLow({
      productVariantId,
      currentQuantity: quantity,
      threshold,
      isOutOfStock: quantity === 0,
    });
  }

  private async publishStockUpdated(productVariantId: string, quantity: number, reservedQuantity: number) {
    await this.publisher.publishStockUpdated({
      productVariantId,
      quantity,
      reservedQuantity,
      availableQuantity: quantity - reservedQuantity,
    });
  }

  // ─── findOrCreateByVariantId ───────────────────────────────────────────────

  async findOrCreate(productVariantId: string, tx?: any) {
    const client = tx ?? this.prisma;
    let inv = await client.inventory.findUnique({ where: { productVariantId } });
    if (!inv) {
      inv = await client.inventory.create({
        data: { productVariantId, quantity: 0, reservedQuantity: 0 },
      });
    }
    return inv;
  }

  // ─── GET ALL ──────────────────────────────────────────────────────────────

  async findAll(query: QueryInventoryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryWhereInput = {};
    if (query.variantId) where.productVariantId = query.variantId;
    if (query.zeroStockOnly) {
      where.quantity = 0;
    } else if (query.lowStockOnly) {
      where.AND = [
        { quantity: { gt: 0 } },
        { quantity: { lte: this.prisma.inventory.fields.lowStockThreshold as any } },
      ];
      // Use raw approach
      const [items, total] = await this.prisma.$transaction([
        this.prisma.inventory.findMany({
          where: {
            ...(query.variantId ? { productVariantId: query.variantId } : {}),
            AND: [{ quantity: { lte: this.prisma.inventory.fields.lowStockThreshold as any } }],
          },
          skip,
          take: limit,
          orderBy: { [query.sortBy ?? 'updatedAt']: query.sortOrder ?? 'desc' },
        }),
        this.prisma.inventory.count({ where }),
      ]);
      return { data: items.map(this.mapInventory.bind(this)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    const sortField = query.sortBy === 'reservedQuantity' ? 'reservedQuantity' : query.sortBy === 'quantity' ? 'quantity' : 'updatedAt';
    const orderBy: any = { [sortField]: query.sortOrder ?? 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({ where, skip, take: limit, orderBy }),
      this.prisma.inventory.count({ where }),
    ]);

    return {
      success: true,
      data: items.map(this.mapInventory.bind(this)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  async findOne(variantId: string) {
    const inv = await this.prisma.inventory.findUnique({ where: { productVariantId: variantId } });
    if (!inv) throw new InventoryNotFoundException(variantId);
    return this.mapInventory(inv);
  }

  // ─── GET LOW STOCK ────────────────────────────────────────────────────────

  async getLowStock(query: QueryLowStockDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Raw SQL to compare quantity <= low_stock_threshold
    const [items, countResult] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT * FROM INVENTORY
        WHERE quantity <= low_stock_threshold
        ${query.includeZero === false ? Prisma.sql`AND quantity > 0` : Prisma.empty}
        ORDER BY quantity ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as total FROM INVENTORY
        WHERE quantity <= low_stock_threshold
        ${query.includeZero === false ? Prisma.sql`AND quantity > 0` : Prisma.empty}
      `,
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    return {
      success: true,
      data: items.map((row: any) => ({
        id: row.id,
        productVariantId: row.product_variant_id,
        quantity: row.quantity,
        reservedQuantity: row.reserved_quantity,
        availableQuantity: row.quantity - row.reserved_quantity,
        lowStockThreshold: row.low_stock_threshold,
        isOutOfStock: row.quantity === 0,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── GET TRANSACTIONS ─────────────────────────────────────────────────────

  async getTransactions(variantId: string, query: QueryTransactionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryTransactionWhereInput = { productVariantId: variantId };
    if (query.type) where.type = query.type as InventoryTxnType;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);

    return {
      success: true,
      data: transactions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── IMPORT STOCK ─────────────────────────────────────────────────────────

  async importStock(variantId: string, dto: ImportStockDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await this.findOrCreate(variantId, tx);
      const before = inv.quantity;
      const after = before + dto.quantity;

      await tx.inventory.update({
        where: { productVariantId: variantId },
        data: { quantity: after },
      });

      const txn = await tx.inventoryTransaction.create({
        data: {
          productVariantId: variantId,
          type: InventoryTxnType.import,
          quantityChange: dto.quantity,
          quantityBefore: before,
          quantityAfter: after,
          referenceId: dto.referenceId ?? null,
          referenceType: dto.referenceId ? TxnReferenceType.import_bill : null,
          note: dto.note ?? null,
          createdBy: userId,
        },
      });

      await this.publishStockUpdated(variantId, after, inv.reservedQuantity);

      return {
        transaction: txn,
        inventory: { quantity: after, reservedQuantity: inv.reservedQuantity, availableQuantity: after - inv.reservedQuantity },
      };
    });
  }

  // ─── ADJUSTMENT ───────────────────────────────────────────────────────────

  async adjustment(variantId: string, dto: AdjustmentDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { productVariantId: variantId } });
      if (!inv) throw new InventoryNotFoundException(variantId);

      const before = inv.quantity;
      const change = dto.quantityAfter - before;

      await tx.inventory.update({
        where: { productVariantId: variantId },
        data: { quantity: dto.quantityAfter },
      });

      const txn = await tx.inventoryTransaction.create({
        data: {
          productVariantId: variantId,
          type: InventoryTxnType.adjustment,
          quantityChange: change,
          quantityBefore: before,
          quantityAfter: dto.quantityAfter,
          referenceType: TxnReferenceType.manual,
          note: dto.note,
          createdBy: userId,
        },
      });

      await this.checkAndPublishStockLow(variantId, dto.quantityAfter, inv.lowStockThreshold);
      await this.publishStockUpdated(variantId, dto.quantityAfter, inv.reservedQuantity);

      return { transaction: txn };
    });
  }

  // ─── UPDATE THRESHOLD ─────────────────────────────────────────────────────

  async updateThreshold(variantId: string, threshold: number) {
    const inv = await this.prisma.inventory.findUnique({ where: { productVariantId: variantId } });
    if (!inv) throw new InventoryNotFoundException(variantId);

    const updated = await this.prisma.inventory.update({
      where: { productVariantId: variantId },
      data: { lowStockThreshold: threshold },
    });

    return { productVariantId: variantId, lowStockThreshold: threshold, updatedAt: updated.updatedAt };
  }

  // ─── BULK CHECK ───────────────────────────────────────────────────────────

  async bulkCheck(dto: BulkCheckDto) {
    const variantIds = dto.items.map((i) => i.productVariantId);
    const inventories = await this.prisma.inventory.findMany({
      where: { productVariantId: { in: variantIds } },
    });

    const invMap = new Map(inventories.map((inv) => [inv.productVariantId, inv]));

    const items = dto.items.map((item) => {
      const inv = invMap.get(item.productVariantId);
      const available = inv ? inv.quantity - inv.reservedQuantity : 0;
      return {
        productVariantId: item.productVariantId,
        requested: item.quantity,
        available,
        sufficient: available >= item.quantity,
      };
    });

    return {
      allAvailable: items.every((i) => i.sufficient),
      items,
    };
  }

  // ─── RESERVE STOCK (from order.created event) ─────────────────────────────

  async reserveStock(orderId: string, items: OrderItem[]): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          const inv = await tx.inventory.findUnique({ where: { productVariantId: item.productVariantId } });
          if (!inv) throw new InventoryNotFoundException(item.productVariantId);

          const available = inv.quantity - inv.reservedQuantity;
          if (available < item.quantity) {
            throw new InsufficientStockException(item.productVariantId, available, item.quantity);
          }

          await tx.inventory.update({
            where: { productVariantId: item.productVariantId },
            data: { reservedQuantity: { increment: item.quantity } },
          });

          await tx.inventoryTransaction.create({
            data: {
              productVariantId: item.productVariantId,
              type: InventoryTxnType.reserve,
              quantityChange: -item.quantity,
              quantityBefore: inv.quantity,
              quantityAfter: inv.quantity,
              referenceId: orderId,
              referenceType: TxnReferenceType.order,
              createdBy: 'system',
            },
          });
        }
      },
      { isolationLevel: 'Serializable', timeout: 10000 },
    );
  }

  // ─── DEDUCT STOCK (from order.confirmed event) ────────────────────────────

  async deductStock(orderId: string): Promise<void> {
    const reserveTxns = await this.prisma.inventoryTransaction.findMany({
      where: { referenceId: orderId, type: InventoryTxnType.reserve },
    });

    if (reserveTxns.length === 0) {
      this.logger.warn(`No reserve transactions found for order ${orderId}`);
      return;
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const reserveTxn of reserveTxns) {
          const qty = Math.abs(reserveTxn.quantityChange);
          const inv = await tx.inventory.findUnique({
            where: { productVariantId: reserveTxn.productVariantId },
          });
          if (!inv) continue;

          const newQty = inv.quantity - qty;
          await tx.inventory.update({
            where: { productVariantId: reserveTxn.productVariantId },
            data: {
              quantity: { decrement: qty },
              reservedQuantity: { decrement: qty },
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              productVariantId: reserveTxn.productVariantId,
              type: InventoryTxnType.export_sale,
              quantityChange: -qty,
              quantityBefore: inv.quantity,
              quantityAfter: newQty,
              referenceId: orderId,
              referenceType: TxnReferenceType.order,
              createdBy: 'system',
            },
          });

          // Check low stock after deduct
          await this.checkAndPublishStockLow(reserveTxn.productVariantId, newQty, inv.lowStockThreshold);
          await this.publishStockUpdated(reserveTxn.productVariantId, newQty, inv.reservedQuantity - qty);
        }
      },
      { isolationLevel: 'Serializable', timeout: 10000 },
    );
  }

  // ─── RELEASE RESERVE (from order.cancelled event) ─────────────────────────

  async releaseReserve(orderId: string): Promise<void> {
    const reserveTxns = await this.prisma.inventoryTransaction.findMany({
      where: { referenceId: orderId, type: InventoryTxnType.reserve },
    });

    if (reserveTxns.length === 0) {
      this.logger.warn(`No reserve transactions found for order ${orderId} — skipping release`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const reserveTxn of reserveTxns) {
        const qty = Math.abs(reserveTxn.quantityChange);
        const inv = await tx.inventory.findUnique({
          where: { productVariantId: reserveTxn.productVariantId },
        });
        if (!inv) continue;

        await tx.inventory.update({
          where: { productVariantId: reserveTxn.productVariantId },
          data: { reservedQuantity: { decrement: qty } },
        });

        await tx.inventoryTransaction.create({
          data: {
            productVariantId: reserveTxn.productVariantId,
            type: InventoryTxnType.release_reserve,
            quantityChange: qty,
            quantityBefore: inv.quantity,
            quantityAfter: inv.quantity,
            referenceId: orderId,
            referenceType: TxnReferenceType.order,
            createdBy: 'system',
          },
        });
      }
    });
  }

  // ─── INITIALIZE (from product.variant_created event) ──────────────────────

  async initializeInventory(productVariantId: string): Promise<void> {
    await this.prisma.inventory.upsert({
      where: { productVariantId },
      create: { productVariantId, quantity: 0, reservedQuantity: 0 },
      update: {},
    });
  }
}
