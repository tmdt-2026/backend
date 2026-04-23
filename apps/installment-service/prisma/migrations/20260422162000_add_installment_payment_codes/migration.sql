-- Add unique application code for each installment profile
SET @application_code_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentApplication'
    AND column_name = 'application_code'
);
SET @application_code_col_sql := IF(
  @application_code_col_exists = 0,
  'ALTER TABLE `InstallmentApplication` ADD COLUMN `application_code` VARCHAR(191) NOT NULL DEFAULT ''''',
  'SELECT 1'
);
PREPARE stmt_application_code_col FROM @application_code_col_sql;
EXECUTE stmt_application_code_col;
DEALLOCATE PREPARE stmt_application_code_col;

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
SET @installment_no_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentSchedule'
    AND column_name = 'installment_no'
);
SET @installment_no_col_sql := IF(
  @installment_no_col_exists = 0,
  'ALTER TABLE `InstallmentSchedule` ADD COLUMN `installment_no` INT NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE stmt_installment_no_col FROM @installment_no_col_sql;
EXECUTE stmt_installment_no_col;
DEALLOCATE PREPARE stmt_installment_no_col;

SET @payment_code_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentSchedule'
    AND column_name = 'payment_code'
);
SET @payment_code_col_sql := IF(
  @payment_code_col_exists = 0,
  'ALTER TABLE `InstallmentSchedule` ADD COLUMN `payment_code` VARCHAR(191) NOT NULL DEFAULT ''''',
  'SELECT 1'
);
PREPARE stmt_payment_code_col FROM @payment_code_col_sql;
EXECUTE stmt_payment_code_col;
DEALLOCATE PREPARE stmt_payment_code_col;

SET @payment_method_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentSchedule'
    AND column_name = 'payment_method'
);
SET @payment_method_col_sql := IF(
  @payment_method_col_exists = 0,
  'ALTER TABLE `InstallmentSchedule` ADD COLUMN `payment_method` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt_payment_method_col FROM @payment_method_col_sql;
EXECUTE stmt_payment_method_col;
DEALLOCATE PREPARE stmt_payment_method_col;

SET @payment_note_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentSchedule'
    AND column_name = 'payment_note'
);
SET @payment_note_col_sql := IF(
  @payment_note_col_exists = 0,
  'ALTER TABLE `InstallmentSchedule` ADD COLUMN `payment_note` TEXT NULL',
  'SELECT 1'
);
PREPARE stmt_payment_note_col FROM @payment_note_col_sql;
EXECUTE stmt_payment_note_col;
DEALLOCATE PREPARE stmt_payment_note_col;

SET @paid_at_col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'InstallmentSchedule'
    AND column_name = 'paid_at'
);
SET @paid_at_col_sql := IF(
  @paid_at_col_exists = 0,
  'ALTER TABLE `InstallmentSchedule` ADD COLUMN `paid_at` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt_paid_at_col FROM @paid_at_col_sql;
EXECUTE stmt_paid_at_col;
DEALLOCATE PREPARE stmt_paid_at_col;

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
