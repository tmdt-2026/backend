-- CreateTable SETTINGS
CREATE TABLE IF NOT EXISTS `SETTINGS` (
  `id`            CHAR(36)        NOT NULL,
  `setting_key`   VARCHAR(255)    NOT NULL,
  `setting_value` TEXT            NULL,
  `setting_type`  ENUM('string','number','boolean','json','html') NOT NULL DEFAULT 'string',
  `group`         VARCHAR(100)    NOT NULL DEFAULT 'general',
  `description`   VARCHAR(500)    NULL,
  `is_public`     BOOLEAN         NOT NULL DEFAULT true,
  `updated_by`    CHAR(36)        NULL,
  `updated_at`    DATETIME(3)     NOT NULL,
  `created_at`    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SETTINGS_setting_key_key` (`setting_key`),
  INDEX `SETTINGS_group_idx` (`group`),
  INDEX `SETTINGS_is_public_idx` (`is_public`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable BANNERS
CREATE TABLE IF NOT EXISTS `BANNERS` (
  `id`               CHAR(36)     NOT NULL,
  `title`            VARCHAR(255) NULL,
  `image_url`        VARCHAR(500) NOT NULL,
  `mobile_image_url` VARCHAR(500) NULL,
  `target_url`       VARCHAR(500) NULL,
  `alt_text`         VARCHAR(255) NULL,
  `position`         VARCHAR(100) NOT NULL DEFAULT 'home_main',
  `sort_order`       INT          NOT NULL DEFAULT 0,
  `start_date`       DATETIME(3)  NULL,
  `end_date`         DATETIME(3)  NULL,
  `is_active`        BOOLEAN      NOT NULL DEFAULT true,
  `click_count`      INT          NOT NULL DEFAULT 0,
  `created_by`       CHAR(36)     NULL,
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BANNERS_position_active_order_idx` (`position`, `is_active`, `sort_order`),
  INDEX `BANNERS_dates_idx` (`start_date`, `end_date`),
  INDEX `BANNERS_active_idx` (`is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
