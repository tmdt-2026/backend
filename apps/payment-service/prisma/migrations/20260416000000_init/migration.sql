-- CreateTable
CREATE TABLE `PAYMENTS` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `payment_method` ENUM('cod', 'vnpay', 'momo', 'bank_transfer') NOT NULL,
    `status` ENUM('pending', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
    `transaction_code` VARCHAR(255) NULL,
    `provider_response` TEXT NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PAYMENTS_order_id_key`(`order_id`),
    INDEX `PAYMENTS_order_id_idx`(`order_id`),
    INDEX `PAYMENTS_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
