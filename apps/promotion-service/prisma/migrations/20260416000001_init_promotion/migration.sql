-- CreateTable PROMOTIONS
CREATE TABLE `PROMOTIONS` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `discount_type` ENUM('PERCENTAGE','FIXED_AMOUNT') NOT NULL,
    `discount_value` DECIMAL(12, 2) NOT NULL,
    `max_discount` DECIMAL(12, 2) NULL,
    `min_order_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `usage_limit` INT NULL,
    `per_user_limit` INT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PROMOTIONS_code_key`(`code`),
    INDEX `PROMOTIONS_code_idx`(`code`),
    INDEX `PROMOTIONS_is_active_idx`(`is_active`),
    INDEX `PROMOTIONS_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable PROMOTION_USAGES
CREATE TABLE `PROMOTION_USAGES` (
    `id` CHAR(36) NOT NULL,
    `promotion_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NULL,
    `used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PROMOTION_USAGES_promotion_id_user_id_key`(`promotion_id`, `user_id`),
    INDEX `PROMOTION_USAGES_user_id_idx`(`user_id`),
    INDEX `PROMOTION_USAGES_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PROMOTION_USAGES` ADD CONSTRAINT `PROMOTION_USAGES_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `PROMOTIONS`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
