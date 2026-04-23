-- Add unique application code for each installment profile
ALTER TABLE `InstallmentApplication`
  ADD COLUMN IF NOT EXISTS `application_code` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `InstallmentApplication`
SET `application_code` = CONCAT('HS-', UPPER(SUBSTRING(`id`, 1, 8)))
WHERE `application_code` = '';

SET @app_code_idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentApplication'
    AND index_name = 'InstallmentApplication_application_code_key'
);
SET @app_code_idx_sql := IF(
  @app_code_idx_exists = 0,
  'ALTER TABLE `InstallmentApplication` ADD UNIQUE INDEX `InstallmentApplication_application_code_key` (`application_code`)',
  'SELECT 1'
);
PREPARE stmt_app_code_idx FROM @app_code_idx_sql;
EXECUTE stmt_app_code_idx;
DEALLOCATE PREPARE stmt_app_code_idx;

-- Add monthly payment tracking fields on repayment schedules
ALTER TABLE `InstallmentSchedule`
  ADD COLUMN IF NOT EXISTS `installment_no` INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `payment_code` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS `payment_method` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `payment_note` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `paid_at` DATETIME(3) NULL;

UPDATE `InstallmentSchedule` s
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `application_id` ORDER BY `due_date`, `id`) AS `rn`
  FROM `InstallmentSchedule`
) seq ON seq.`id` = s.`id`
SET s.`installment_no` = seq.`rn`;

UPDATE `InstallmentSchedule` s
JOIN `InstallmentApplication` a ON a.`id` = s.`application_id`
SET s.`payment_code` = CONCAT(a.`application_code`, '-K', LPAD(s.`installment_no`, 2, '0'))
WHERE s.`payment_code` = '';

SET @payment_code_idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentSchedule'
    AND index_name = 'InstallmentSchedule_payment_code_key'
);
SET @payment_code_idx_sql := IF(
  @payment_code_idx_exists = 0,
  'ALTER TABLE `InstallmentSchedule` ADD UNIQUE INDEX `InstallmentSchedule_payment_code_key` (`payment_code`)',
  'SELECT 1'
);
PREPARE stmt_payment_code_idx FROM @payment_code_idx_sql;
EXECUTE stmt_payment_code_idx;
DEALLOCATE PREPARE stmt_payment_code_idx;
