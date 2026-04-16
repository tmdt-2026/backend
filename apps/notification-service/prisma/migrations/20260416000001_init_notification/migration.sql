-- CreateTable EMAIL_TEMPLATES
CREATE TABLE `EMAIL_TEMPLATES` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `html_body` LONGTEXT NOT NULL,
    `text_body` TEXT NULL,
    `variables` JSON NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `updated_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EMAIL_TEMPLATES_key_key`(`key`),
    INDEX `EMAIL_TEMPLATES_key_idx`(`key`),
    INDEX `EMAIL_TEMPLATES_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable EMAIL_LOGS
CREATE TABLE `EMAIL_LOGS` (
    `id` CHAR(36) NOT NULL,
    `template_id` CHAR(36) NULL,
    `template_key` VARCHAR(100) NOT NULL,
    `to_email` VARCHAR(255) NOT NULL,
    `to_name` VARCHAR(255) NULL,
    `subject` VARCHAR(500) NOT NULL,
    `html_body` LONGTEXT NOT NULL,
    `variables` JSON NULL,
    `status` ENUM('PENDING','SENT','FAILED','PERMANENTLY_FAILED') NOT NULL DEFAULT 'PENDING',
    `attempt` INT NOT NULL DEFAULT 0,
    `sent_at` DATETIME(3) NULL,
    `fail_reason` TEXT NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `EMAIL_LOGS_template_key_idx`(`template_key`),
    INDEX `EMAIL_LOGS_to_email_idx`(`to_email`),
    INDEX `EMAIL_LOGS_status_idx`(`status`),
    INDEX `EMAIL_LOGS_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `EMAIL_LOGS_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EMAIL_LOGS` ADD CONSTRAINT `EMAIL_LOGS_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `EMAIL_TEMPLATES`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
