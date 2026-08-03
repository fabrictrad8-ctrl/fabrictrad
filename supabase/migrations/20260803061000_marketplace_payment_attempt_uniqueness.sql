-- Only one active Razorpay attempt may exist for an order at a time.
-- Captured/failed/refunded rows remain as immutable history and do not block a later balance payment.

CREATE UNIQUE INDEX IF NOT EXISTS catalog_order_payments_one_active_attempt
  ON public.catalog_order_payments(catalog_order_id)
  WHERE status IN ('initiated', 'authorized');

CREATE UNIQUE INDEX IF NOT EXISTS bulk_order_payments_one_active_attempt
  ON public.bulk_order_payments(bulk_order_id)
  WHERE status IN ('initiated', 'authorized');

CREATE INDEX IF NOT EXISTS catalog_order_payments_status_created_idx
  ON public.catalog_order_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS bulk_order_payments_status_created_idx
  ON public.bulk_order_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_tax_invoices_status_issued_idx
  ON public.seller_tax_invoices(status, issued_at DESC);
