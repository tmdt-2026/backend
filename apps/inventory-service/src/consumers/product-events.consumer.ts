import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InventoryService } from '../inventory/inventory.service';

interface VariantCreatedPayload {
  variantId: string;
  productId: string;
  sku: string;
  createdAt: string;
}

@Controller()
export class ProductEventsConsumer {
  private readonly logger = new Logger(ProductEventsConsumer.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @EventPattern('product.variant_created')
  async handleVariantCreated(@Payload() payload: VariantCreatedPayload): Promise<void> {
    this.logger.log(`Handling product.variant_created: ${payload.variantId}`);
    try {
      await this.inventoryService.initializeInventory(payload.variantId);
      this.logger.log(`Initialized inventory for variant ${payload.variantId}`);
    } catch (err: any) {
      this.logger.error(`Failed to initialize inventory for ${payload.variantId}: ${err.message}`);
    }
  }
}
