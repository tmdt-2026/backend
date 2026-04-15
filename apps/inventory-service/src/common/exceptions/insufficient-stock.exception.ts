import { BadRequestException, NotFoundException } from '@nestjs/common';

export class InventoryNotFoundException extends NotFoundException {
  constructor(variantId: string) {
    super({
      statusCode: 404,
      message: `Inventory not found for variant ${variantId}`,
      error: 'INVENTORY_NOT_FOUND',
    });
  }
}

export class InsufficientStockException extends BadRequestException {
  constructor(variantId: string, available: number, required: number) {
    super({
      statusCode: 422,
      message: `Insufficient stock for variant ${variantId}. Available: ${available}, Required: ${required}`,
      error: 'INSUFFICIENT_STOCK',
      available,
      required,
    });
  }
}

export class TransactionTimeoutException extends BadRequestException {
  constructor() {
    super({
      statusCode: 500,
      message: 'Transaction timeout - inventory lock wait too long',
      error: 'TRANSACTION_TIMEOUT',
    });
  }
}