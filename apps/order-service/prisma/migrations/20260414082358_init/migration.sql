-- CreateTable
CREATE TABLE `ORDERS` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `promotion_id` CHAR(36) NULL,
    `payment_type` ENUM('full', 'installment') NOT NULL,
    `payment_method` ENUM('cod', 'vnpay', 'momo', 'bank_transfer') NOT NULL,
    `subtotal_price` DECIMAL(18, 2) NOT NULL,
    `discount_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `total_price` DECIMAL(18, 2) NOT NULL,
    `total_product` INTEGER NOT NULL,
    `status` ENUM('pending', 'processing', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `shipping_name` VARCHAR(255) NOT NULL,
    `shipping_phone` VARCHAR(20) NOT NULL,
    `shipping_province` VARCHAR(255) NOT NULL,
    `shipping_district` VARCHAR(255) NOT NULL,
    `shipping_ward` VARCHAR(255) NOT NULL,
    `shipping_street` VARCHAR(500) NOT NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ORDER_DETAILS` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `product_variant_id` CHAR(36) NOT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `variant_label` VARCHAR(255) NULL,
    `quantity` INTEGER NOT NULL,
    `import_price` DECIMAL(18, 2) NOT NULL,
    `price` DECIMAL(18, 2) NOT NULL,
    `item_discount` DECIMAL(18, 2) NOT NULL DEFAULT 0,

    INDEX `ORDER_DETAILS_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ORDER_DETAILS` ADD CONSTRAINT `ORDER_DETAILS_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `ORDERS`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
