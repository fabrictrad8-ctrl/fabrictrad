-- ---------------------------------------------------------------------------
-- Bulk-order payment ledger owned exclusively by server operations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bulk_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_order_id uuid NOT NULL REFERENCES public.bulk_orders(id) ON DELETE RESTRICT,
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'authorized', 'captured', 'failed', 'refunded')),
  platform_commission numeric(12,2) NOT NULL DEFAULT 0,
  razorpay_fee numeric(12,2) NOT NULL DEFAULT 0,
  gst_on_commission numeric(12,2) NOT NULL DEFAULT 0,
  seller_payable numeric(12,2) NOT NULL DEFAULT 0,
  razorpay_transfer_id text,
  failure_reason text,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_order_payments_order
  ON public.bulk_order_payments(bulk_order_id);
CREATE INDEX IF NOT EXISTS idx_bulk_order_payments_payment
  ON public.bulk_order_payments(razorpay_payment_id);

ALTER TABLE public.bulk_order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyers_read_own_bulk_order_payments"
  ON public.bulk_order_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_orders
      WHERE id = bulk_order_id AND buyer_id = auth.uid()
    )
  );
CREATE POLICY "sellers_read_assigned_bulk_order_payments"
  ON public.bulk_order_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_orders
      WHERE id = bulk_order_id AND seller_id = public.my_seller_id()
    )
  );
CREATE POLICY "admins_manage_bulk_order_payments"
  ON public.bulk_order_payments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

WITH duplicate_taxation_splits AS (
  SELECT id, row_number() OVER (PARTITION BY transaction_id ORDER BY created_at DESC) AS rn
  FROM public.taxation_splits
  WHERE transaction_id IS NOT NULL
)
DELETE FROM public.taxation_splits
WHERE id IN (SELECT id FROM duplicate_taxation_splits WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxation_splits_transaction_unique
  ON public.taxation_splits(transaction_id);

ALTER TABLE public.bulk_orders
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb;
