-- Migration: Webhook reliability infrastructure + seller registration tables
-- Timestamp: 20260717200000

-- ─── webhook_events (idempotency store) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('razorpay', 'shiprocket')),
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency_key ON public.webhook_events (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source_event ON public.webhook_events (source, event_type);

-- ─── webhook_dead_letter_queue ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('razorpay', 'shiprocket')),
  event_type TEXT NOT NULL,
  payload JSONB,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 4,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'dead', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_status ON public.webhook_dead_letter_queue (status);
CREATE INDEX IF NOT EXISTS idx_dlq_next_retry ON public.webhook_dead_letter_queue (next_retry_at) WHERE status IN ('pending', 'retrying');

-- ─── seller_registrations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  owner_name TEXT,
  email TEXT,
  business_name TEXT,
  business_type TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  address TEXT,
  categories TEXT[],
  monthly_capacity TEXT,
  gstin TEXT,
  pan TEXT,
  gstin_verified BOOLEAN NOT NULL DEFAULT FALSE,
  gstin_verified_at TIMESTAMPTZ,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_name TEXT,
  bank_name TEXT,
  razorpay_linked_account_id TEXT,
  bank_verified BOOLEAN NOT NULL DEFAULT FALSE,
  bank_verified_at TIMESTAMPTZ,
  registration_status TEXT NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'documents_uploaded', 'under_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_registrations_status ON public.seller_registrations (registration_status);
CREATE INDEX IF NOT EXISTS idx_seller_registrations_gstin ON public.seller_registrations (gstin);

-- ─── seller_registration_documents ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_registration_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.seller_registrations (id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('gst_certificate', 'pan_card', 'cancelled_cheque', 'business_proof', 'address_proof')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  upload_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'under_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, document_type)
);

-- ─── payment_ledger: add reconciliation columns to existing table ──────────────
-- The payment_ledger table already exists from the previous migration.
-- We add the reconciliation columns if they don't exist yet.
ALTER TABLE public.payment_ledger
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS discrepancy_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS settlement_delay_hours INTEGER DEFAULT 0;

-- Add CHECK constraint for reconciliation_status if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_ledger_reconciliation_status_check'
      AND conrelid = 'public.payment_ledger'::regclass
  ) THEN
    ALTER TABLE public.payment_ledger
      ADD CONSTRAINT payment_ledger_reconciliation_status_check
      CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'flagged'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_ledger_rzp_payment ON public.payment_ledger (razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_reconciliation ON public.payment_ledger (reconciliation_status);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- webhook_events: service role only
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_events' AND policyname = 'service_role_only') THEN
    CREATE POLICY service_role_only ON public.webhook_events
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- webhook_dead_letter_queue: service role + admin
ALTER TABLE public.webhook_dead_letter_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_dead_letter_queue' AND policyname = 'admin_or_service') THEN
    CREATE POLICY admin_or_service ON public.webhook_dead_letter_queue
      USING (auth.role() = 'service_role' OR EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'
      ));
  END IF;
END $$;

-- seller_registrations: seller can see own, admin sees all
ALTER TABLE public.seller_registrations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_registrations' AND policyname = 'seller_own_or_admin') THEN
    CREATE POLICY seller_own_or_admin ON public.seller_registrations
      USING (
        phone = (SELECT phone FROM public.user_profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;

-- payment_ledger admin/service policy for reconciliation columns (already has RLS from prior migration)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_ledger' AND policyname = 'admin_or_service_ledger') THEN
    CREATE POLICY admin_or_service_ledger ON public.payment_ledger
      USING (
        auth.role() = 'service_role'
        OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
      );
  END IF;
END $$;
