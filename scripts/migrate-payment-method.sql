-- Migration helper: remap legacy payment_method values before running
-- `prisma migrate dev` on order-service and payment-service schemas.
--
-- Run against db_orders first, then db_payments.
-- Safe to run multiple times (idempotent WHERE clauses).

-- ── db_orders ──────────────────────────────────────────────────────────────
USE db_orders;

-- Remap unsupported methods to cod (conservative default)
UPDATE ORDERS SET payment_method = 'cod'
WHERE payment_method IN ('momo', 'bank_transfer');

-- Remap old status values to aligned values
UPDATE ORDERS SET status = 'confirmed'  WHERE status = 'processing';
UPDATE ORDERS SET status = 'shipping'   WHERE status = 'shipped';
UPDATE ORDERS SET status = 'delivered'  WHERE status = 'completed';

-- ── db_payments ────────────────────────────────────────────────────────────
USE db_payments;

-- COD orders never create a Payment row, so only momo/bank_transfer rows remain.
-- Map any legacy rows to vnpay (they represent online transactions).
UPDATE PAYMENTS SET payment_method = 'vnpay'
WHERE payment_method IN ('cod', 'momo', 'bank_transfer');
