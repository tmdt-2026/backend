/*
  Warnings:

  - You are about to drop the column `phone_number` on the `USER_DETAILS` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `USERS` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `USER_DETAILS` DROP COLUMN `phone_number`,
    MODIFY `avatar_url` VARCHAR(500) NULL,
    ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `USERS_email_idx` ON `USERS`(`email`);

-- RenameIndex
ALTER TABLE `USERS` RENAME INDEX `idx_users_active` TO `USERS_is_active_idx`;
