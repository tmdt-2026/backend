-- Add customer profile fields for installment applications
ALTER TABLE `InstallmentApplication`
  ADD COLUMN `full_name` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `phone_number` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `email` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `national_id` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `monthly_income` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `occupation` VARCHAR(191) NULL,
  ADD COLUMN `company_name` VARCHAR(191) NULL,
  ADD COLUMN `company_address` VARCHAR(191) NULL,
  ADD COLUMN `application_note` TEXT NULL;
