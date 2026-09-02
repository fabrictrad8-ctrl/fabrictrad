-- Complete the bespoke Razorpay ledger for webhook-driven capture and refunds.
-- Refund events use their own unique ledger so retries and multiple partial
-- refunds cannot double-decrement the amount paid on a custom order.

ALTER TABLE public.bespoke_payments
  DROP CONSTRAINT IF EXISTS bespoke_payments_status_check;

ALTER TABLE public.bespoke_payments
  ADD CONSTRAINT bespoke_payments_status_check
  CHECK (status IN ('initiated','authorized','captured','partially_refunded','failed','refunded'));

ALTER TABLE public.bespoke_payments
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none','requested','processed','failed')),
  ADD COLUMN IF NOT EXISTS last_refund_id text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS last_webhook_event text,
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz;

CREATE TABLE IF NOT EXISTS public.bespoke_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_payment_id uuid NOT NULL REFERENCES public.bespoke_payments(id) ON DELETE CASCADE,
  bespoke_order_id uuid NOT NULL REFERENCES public.bespoke_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_refund_id text NOT NULL UNIQUE,
  razorpay_payment_id text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processed','failed')),
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bespoke_refunds_payment_created_idx
  ON public.bespoke_refunds (bespoke_payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bespoke_refunds_order_created_idx
  ON public.bespoke_refunds (bespoke_order_id, created_at DESC);

ALTER TABLE public.bespoke_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bespoke_refunds_read_own ON public.bespoke_refunds;
CREATE POLICY bespoke_refunds_read_own ON public.bespoke_refunds
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.bespoke_refunds FROM anon, authenticated;
GRANT SELECT ON TABLE public.bespoke_refunds TO authenticated;
GRANT ALL ON TABLE public.bespoke_refunds TO service_role;

COMMENT ON TABLE public.bespoke_refunds IS
  'Replay-safe Razorpay refund events for bespoke payments, including multiple partial refunds.';

-- The API checks first for a useful error message; this index is the final
-- concurrency guard when web and WhatsApp requests arrive at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS bespoke_appointments_one_active_type_idx
  ON public.bespoke_appointments (bespoke_order_id, appointment_type)
  WHERE status IN ('requested','confirmed','reschedule_requested');
