-- Idempotent payment ledger for bespoke/custom orders.
-- A single order can have an advance and a later balance payment, so keeping
-- only the most recent Razorpay payment id on bespoke_orders is insufficient
-- for replay-safe reconciliation.

CREATE TABLE IF NOT EXISTS public.bespoke_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_order_id uuid NOT NULL REFERENCES public.bespoke_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id text NOT NULL,
  razorpay_payment_id text,
  payment_purpose text NOT NULL CHECK (payment_purpose IN ('advance','full','balance')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','authorized','captured','failed','refunded')),
  provider_status text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bespoke_payments_razorpay_order_unique_idx
  ON public.bespoke_payments (razorpay_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS bespoke_payments_razorpay_payment_unique_idx
  ON public.bespoke_payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
-- Prevent two simultaneously payable provider orders for one FabricTrad order.
-- Authorized but not captured is still payable, so it must remain exclusive.
CREATE UNIQUE INDEX IF NOT EXISTS bespoke_payments_one_active_session_idx
  ON public.bespoke_payments (bespoke_order_id)
  WHERE status IN ('initiated','authorized');
CREATE INDEX IF NOT EXISTS bespoke_payments_order_created_idx
  ON public.bespoke_payments (bespoke_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bespoke_payments_user_created_idx
  ON public.bespoke_payments (user_id, created_at DESC);

ALTER TABLE public.bespoke_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bespoke_payments_read_own ON public.bespoke_payments;
CREATE POLICY bespoke_payments_read_own ON public.bespoke_payments
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.bespoke_payments FROM anon, authenticated;
GRANT SELECT ON TABLE public.bespoke_payments TO authenticated;
GRANT ALL ON TABLE public.bespoke_payments TO service_role;

COMMENT ON TABLE public.bespoke_payments IS
  'Immutable-ish Razorpay payment ledger for bespoke advance/full/balance payments; unique provider ids make browser retries idempotent.';
