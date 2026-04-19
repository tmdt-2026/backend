-- CreateTable
CREATE TABLE `InstallmentPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `duration_months` INTEGER NOT NULL,
    `interest_rate` DOUBLE NOT NULL,
    `min_order_value` DOUBLE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstallmentApplication` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `total_amount` DOUBLE NOT NULL,
    `loan_amount` DOUBLE NOT NULL,
    `monthly_payment` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstallmentSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `application_id` VARCHAR(191) NOT NULL,
    `due_date` DATETIME(3) NOT NULL,
    `amount_due` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unpaid',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InstallmentApplication` ADD CONSTRAINT `InstallmentApplication_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `InstallmentPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InstallmentSchedule` ADD CONSTRAINT `InstallmentSchedule_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `InstallmentApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
