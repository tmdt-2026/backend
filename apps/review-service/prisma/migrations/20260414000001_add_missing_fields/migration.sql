-- AlterTable REVIEWS: add missing columns
ALTER TABLE `REVIEWS`
    ADD COLUMN `images` JSON NULL,
    ADD COLUMN `admin_note` VARCHAR(500) NULL,
    ADD COLUMN `user_name_snapshot` VARCHAR(255) NULL,
    ADD COLUMN `product_name_snapshot` VARCHAR(255) NULL;

-- Add additional indexes on REVIEWS
CREATE INDEX `idx_review_product_visible` ON `REVIEWS`(`product_id`, `is_visible`);
CREATE INDEX `idx_review_user` ON `REVIEWS`(`user_id`);
CREATE INDEX `idx_review_rating` ON `REVIEWS`(`rating`);

-- AlterTable COMMENTS: add missing columns
ALTER TABLE `COMMENTS`
    ADD COLUMN `depth` INT NOT NULL DEFAULT 0,
    ADD COLUMN `admin_note` VARCHAR(500) NULL,
    ADD COLUMN `edited_at` DATETIME(3) NULL,
    ADD COLUMN `user_name_snapshot` VARCHAR(255) NULL,
    ADD COLUMN `user_role_snapshot` VARCHAR(50) NULL;

-- Add additional indexes on COMMENTS
CREATE INDEX `idx_comment_product_visible` ON `COMMENTS`(`product_id`, `is_visible`);
CREATE INDEX `idx_comment_user` ON `COMMENTS`(`user_id`);
