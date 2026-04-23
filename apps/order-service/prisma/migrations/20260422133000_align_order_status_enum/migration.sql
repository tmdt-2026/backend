-- Expand enum temporarily to support both legacy and new status values.
ALTER TABLE `ORDERS`
  MODIFY `status` ENUM(
    'pending',
    'processing',
    'shipped',
    'completed',
    'cancelled',
    'confirmed',
    'shipping',
    'delivered'
  ) NOT NULL DEFAULT 'pending';

-- Migrate legacy values to the new workflow values.
UPDATE `ORDERS` SET `status` = 'confirmed' WHERE `status` = 'processing';
UPDATE `ORDERS` SET `status` = 'shipping' WHERE `status` = 'shipped';
UPDATE `ORDERS` SET `status` = 'delivered' WHERE `status` = 'completed';

-- Keep only the new set used by frontend/admin and service logic.
ALTER TABLE `ORDERS`
  MODIFY `status` ENUM(
    'pending',
    'confirmed',
    'shipping',
    'delivered',
    'cancelled'
  ) NOT NULL DEFAULT 'pending';
