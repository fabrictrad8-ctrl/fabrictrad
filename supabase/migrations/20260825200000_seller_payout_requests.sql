-- Migration: seller_payout_requests table for withdrawal request workflow
-- Timestamp: 20260825200000

CREATE TABLE IF NOT EXISTS public.seller_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 100),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  account_holder_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  admin_note text,
  razorpay_payout_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seller_payout_requests_seller_id ON public.seller_payout_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payout_requests_status ON public.seller_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_seller_payout_requests_submitted_at ON public.seller_payout_requests(submitted_at DESC);

-- RLS
ALTER TABLE public.seller_payout_requests ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seller_payout_requests' AND policyname = 'seller_payout_requests_seller_select'
  ) THEN
    CREATE POLICY seller_payout_requests_seller_select
      ON public.seller_payout_requests
      FOR SELECT
      USING (
        seller_id IN (
          SELECT id FROM public.seller_profiles WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Sellers can insert their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seller_payout_requests' AND policyname = 'seller_payout_requests_seller_insert'
  ) THEN
    CREATE POLICY seller_payout_requests_seller_insert
      ON public.seller_payout_requests
      FOR INSERT
      WITH CHECK (
        seller_id IN (
          SELECT id FROM public.seller_profiles WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Admins can view all requests (via service role or admin check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seller_payout_requests' AND policyname = 'seller_payout_requests_admin_all'
  ) THEN
    CREATE POLICY seller_payout_requests_admin_all
      ON public.seller_payout_requests
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'super_admin'::public.user_role
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND role = 'super_admin'::public.user_role
        )
      );
  END IF;
END $$;
