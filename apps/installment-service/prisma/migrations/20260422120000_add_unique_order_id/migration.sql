-- Ensure one installment application per order
CREATE UNIQUE INDEX `InstallmentApplication_order_id_key`
ON `InstallmentApplication`(`order_id`);
