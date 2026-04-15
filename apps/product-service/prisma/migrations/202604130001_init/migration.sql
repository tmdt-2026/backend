-- CreateTable
CREATE TABLE `CATEGORIES` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CATEGORIES_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MODEL` (
    `id` CHAR(36) NOT NULL,
    `model_name` VARCHAR(255) NOT NULL,
    `model_number` VARCHAR(255) NULL,
    `brand` VARCHAR(255) NOT NULL DEFAULT 'Apple',
    `cpu` VARCHAR(255) NULL,
    `screen_size` DECIMAL(5, 2) NULL,
    `opera_system` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PRODUCTS` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `model_id` CHAR(36) NULL,
    `category_id` CHAR(36) NOT NULL,
    `img_url` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `PRODUCTS_category_id_idx`(`category_id`),
    INDEX `PRODUCTS_is_active_deleted_at_idx`(`is_active`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PRODUCT_IMAGES` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `alt_text` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PRODUCT_IMAGES_product_id_sort_order_idx`(`product_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PRODUCT_VARIANTS` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `color` VARCHAR(100) NULL,
    `ram` INTEGER NULL,
    `storage` INTEGER NULL,
    `import_price` DECIMAL(18, 2) NOT NULL,
    `original_price` DECIMAL(18, 2) NULL,
    `price` DECIMAL(18, 2) NOT NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PRODUCT_VARIANTS_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PRICE_HISTORIES` (
    `id` CHAR(36) NOT NULL,
    `product_variant_id` CHAR(36) NOT NULL,
    `changed_by` CHAR(36) NOT NULL,
    `old_import_price` DECIMAL(18, 2) NULL,
    `new_import_price` DECIMAL(18, 2) NULL,
    `old_original_price` DECIMAL(18, 2) NULL,
    `new_original_price` DECIMAL(18, 2) NULL,
    `old_price` DECIMAL(18, 2) NULL,
    `new_price` DECIMAL(18, 2) NULL,
    `reason` VARCHAR(500) NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PRICE_HISTORIES_product_variant_id_changed_at_idx`(`product_variant_id`, `changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CATEGORIES` ADD CONSTRAINT `CATEGORIES_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `CATEGORIES`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PRODUCTS` ADD CONSTRAINT `PRODUCTS_model_id_fkey` FOREIGN KEY (`model_id`) REFERENCES `MODEL`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PRODUCTS` ADD CONSTRAINT `PRODUCTS_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `CATEGORIES`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PRODUCT_IMAGES` ADD CONSTRAINT `PRODUCT_IMAGES_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `PRODUCTS`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PRODUCT_VARIANTS` ADD CONSTRAINT `PRODUCT_VARIANTS_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `PRODUCTS`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PRICE_HISTORIES` ADD CONSTRAINT `PRICE_HISTORIES_product_variant_id_fkey` FOREIGN KEY (`product_variant_id`) REFERENCES `PRODUCT_VARIANTS`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
