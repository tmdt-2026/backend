-- ============================================================
-- Migration: Add REFRESH_TOKENS table and fix ROLES schema
-- ============================================================

-- Fix ROLES.name: add UNIQUE constraint and change type to VarChar(50)
ALTER TABLE `ROLES` MODIFY COLUMN `name` VARCHAR(50) NOT NULL;
ALTER TABLE `ROLES` ADD UNIQUE INDEX `ROLES_name_key`(`name`);

-- Add USER_ADDRESSES table (if not exists from schema changes)
CREATE TABLE IF NOT EXISTS `USER_ADDRESSES` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `label` VARCHAR(100) NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `province` VARCHAR(255) NOT NULL,
    `district` VARCHAR(255) NOT NULL,
    `ward` VARCHAR(255) NOT NULL,
    `street` VARCHAR(500) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `USER_ADDRESSES_user_id_is_default_idx`(`user_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add FCM_TOKENS table (if not exists)
CREATE TABLE IF NOT EXISTS `FCM_TOKENS` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `device_type` ENUM('android', 'ios', 'web') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FCM_TOKENS_token_key`(`token`),
    INDEX `FCM_TOKENS_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add REFRESH_TOKENS table
CREATE TABLE IF NOT EXISTS `REFRESH_TOKENS` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `device_id` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `REFRESH_TOKENS_token_key`(`token`),
    INDEX `REFRESH_TOKENS_user_id_idx`(`user_id`),
    INDEX `REFRESH_TOKENS_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Update USER_DETAILS to match new schema (fullName, avatarUrl, dateOfBirth, gender)
-- Check if old columns exist and rename/add as needed
ALTER TABLE `USER_DETAILS`
    CHANGE COLUMN `name` `full_name` VARCHAR(255) NULL,
    DROP COLUMN `address`,
    ADD COLUMN `date_of_birth` DATE NULL,
    ADD COLUMN `gender` ENUM('male', 'female', 'other') NULL;

-- Add foreign keys
ALTER TABLE `USER_ADDRESSES`
    ADD CONSTRAINT `USER_ADDRESSES_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `USERS`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FCM_TOKENS`
    ADD CONSTRAINT `FCM_TOKENS_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `USERS`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `REFRESH_TOKENS`
    ADD CONSTRAINT `REFRESH_TOKENS_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `USERS`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
