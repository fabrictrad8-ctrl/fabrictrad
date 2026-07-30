-- Complete the direct marketplace order lifecycle: buyer cancellation, seller
-- acceptance/rejection, payment records and protected state transitions.

ALTER TABLE public.catalog_order_requests
  ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

DROP POLICY IF EXISTS buyers_cancel_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_cancel_catalog_order_requests
  ON public.catalog_order_requests FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() AND status IN ('pending', 'accepted'))
  WITH CHECK (buyer_id = auth.uid() AND status = 'cancelled');

CREATE OR REPLACE FUNCTION public.protect_catalog_order_request_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_role text;
  actor_seller_id uuid;
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.variant_id IS DISTINCT FROM OLD.variant_id
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.unit IS DISTINCT FROM OLD.unit
     OR NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.gst_amount IS DISTINCT FROM OLD.gst_amount
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    RAISE EXCEPTION 'Order ownership, products, quantities and totals cannot be changed';
  END IF;

  actor_role := public.get_my_role();
  IF auth.uid() = OLD.buyer_id AND actor_role = 'buyer' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status IN ('pending', 'accepted') AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'Buyer is not allowed to set this order status';
    END IF;
    RETURN NEW;
  END IF;

  actor_seller_id := public.my_seller_id();
  IF actor_seller_id = OLD.seller_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected'))
         OR (OLD.status = 'paid' AND NEW.status = 'fulfilled')
       ) THEN
      RAISE EXCEPTION 'Seller is not allowed to set this order status';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this order';
END;
$$;

DROP TRIGGER IF EXISTS protect_catalog_order_request_state_trigger ON public.catalog_order_requests;
CREATE TRIGGER protect_catalog_order_request_state_trigger
  BEFORE UPDATE ON public.catalog_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_catalog_order_request_state();

CREATE TABLE IF NOT EXISTS public.catalog_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_order_id UUID NOT NULL REFERENCES public.catalog_order_requests(id) ON DELETE RESTRICT,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'authorized', 'captured', 'failed', 'refunded')),
  platform_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  razorpay_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_on_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  seller_payable NUMERIC(12,2) NOT NULL DEFAULT 0,
  razorpay_transfer_id TEXT,
  failure_reason TEXT,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_order_payments_order
  ON public.catalog_order_payments(catalog_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_order_payments_status
  ON public.catalog_order_payments(status, created_at DESC);

ALTER TABLE public.catalog_order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buyers_read_own_catalog_order_payments ON public.catalog_order_payments;
CREATE POLICY buyers_read_own_catalog_order_payments
  ON public.catalog_order_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.catalog_order_requests request
      WHERE request.id = catalog_order_payments.catalog_order_id
        AND request.buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sellers_read_catalog_order_payments ON public.catalog_order_payments;
CREATE POLICY sellers_read_catalog_order_payments
  ON public.catalog_order_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.catalog_order_requests request
      WHERE request.id = catalog_order_payments.catalog_order_id
        AND request.seller_id = public.my_seller_id()
    )
  );

DROP POLICY IF EXISTS admins_manage_catalog_order_payments ON public.catalog_order_payments;
CREATE POLICY admins_manage_catalog_order_payments
  ON public.catalog_order_payments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS catalog_order_payments_updated_at ON public.catalog_order_payments;
CREATE TRIGGER catalog_order_payments_updated_at
  BEFORE UPDATE ON public.catalog_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
