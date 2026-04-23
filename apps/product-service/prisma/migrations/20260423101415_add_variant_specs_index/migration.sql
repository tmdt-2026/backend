-- CreateIndex
CREATE INDEX `idx_variant_product_specs` ON `PRODUCT_VARIANTS`(`product_id`, `color`, `ram`, `storage`, `deleted_at`);
