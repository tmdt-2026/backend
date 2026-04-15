-- Drop old tables (redesign from scratch)
DROP TABLE IF EXISTS `inventory_transactions`;
DROP TABLE IF EXISTS `inventory`;

-- CreateTable INVENTORY
CREATE TABLE `INVENTORY` (
    `id` CHAR(36) NOT NULL,
    `product_variant_id` CHAR(36) NOT NULL,
    `quantity` INT NOT NULL DEFAULT 0,
    `reserved_quantity` INT NOT NULL DEFAULT 0,
    `low_stock_threshold` INT NOT NULL DEFAULT 5,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `INVENTORY_product_variant_id_key`(`product_variant_id`),
    INDEX `INVENTORY_product_variant_id_idx`(`product_variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable INVENTORY_TRANSACTIONS
CREATE TABLE `INVENTORY_TRANSACTIONS` (
    `id` CHAR(36) NOT NULL,
    `product_variant_id` CHAR(36) NOT NULL,
    `type` ENUM('import','export_sale','export_return','reserve','release_reserve','adjustment') NOT NULL,
    `quantity_change` INT NOT NULL,
    `quantity_before` INT NOT NULL,
    `quantity_after` INT NOT NULL,
    `reference_id` VARCHAR(100) NULL,
    `reference_type` ENUM('order','import_bill','manual') NULL,
    `note` VARCHAR(500) NULL,
    `created_by` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `INVENTORY_TRANSACTIONS_product_variant_id_created_at_idx`(`product_variant_id`, `created_at`),
    INDEX `INVENTORY_TRANSACTIONS_type_idx`(`type`),
    INDEX `INVENTORY_TRANSACTIONS_reference_id_idx`(`reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `INVENTORY_TRANSACTIONS` ADD CONSTRAINT `INVENTORY_TRANSACTIONS_product_variant_id_fkey`
    FOREIGN KEY (`product_variant_id`) REFERENCES `INVENTORY`(`product_variant_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
