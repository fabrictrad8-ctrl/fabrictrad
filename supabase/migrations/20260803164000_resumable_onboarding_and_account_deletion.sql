-- Resumable buyer/seller onboarding and auditable, OTP-gated account deletion support.

CREATE TABLE IF NOT EXISTS public.onboarding_drafts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow text NOT NULL CHECK (flow IN ('buyer', 'seller')),
  step text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flow)
);

CREATE INDEX IF NOT EXISTS onboarding_drafts_updated_idx
  ON public.onboarding_drafts(updated_at DESC);

ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_drafts_read_own ON public.onboarding_drafts;
DROP POLICY IF EXISTS onboarding_drafts_insert_own ON public.onboarding_drafts;
DROP POLICY IF EXISTS onboarding_drafts_update_own ON public.onboarding_drafts;
DROP POLICY IF EXISTS onboarding_drafts_delete_own ON public.onboarding_drafts;

CREATE POLICY onboarding_drafts_read_own ON public.onboarding_drafts
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY onboarding_drafts_insert_own ON public.onboarding_drafts
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY onboarding_drafts_update_own ON public.onboarding_drafts
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY onboarding_drafts_delete_own ON public.onboarding_drafts
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.onboarding_drafts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.onboarding_drafts TO authenticated;
GRANT ALL ON TABLE public.onboarding_drafts TO service_role;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'otp_requested'
    CHECK (status IN ('otp_requested', 'blocked', 'otp_verified', 'completed', 'failed', 'cancelled')),
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  otp_verified_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_user_idx
  ON public.account_deletion_requests(user_id, requested_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_deletion_requests_read_own ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_read_own ON public.account_deletion_requests
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.account_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.account_deletion_requests TO authenticated;
GRANT ALL ON TABLE public.account_deletion_requests TO service_role;

CREATE OR REPLACE FUNCTION public.anonymize_current_account_for_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  seller_profile_id uuid;
  deleted_alias text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  deleted_alias := 'deleted+' || replace(current_user_id::text, '-', '') || '@fabrictrad.invalid';

  SELECT seller.id INTO seller_profile_id
  FROM public.seller_profiles seller
  WHERE seller.user_id = current_user_id
  LIMIT 1;

  IF seller_profile_id IS NOT NULL THEN
    UPDATE public.seller_products
    SET status = 'inactive',
        approval_status = 'rejected',
        admin_review_notes = 'Seller account deleted by account owner.',
        updated_at = now()
    WHERE seller_id = seller_profile_id;

    UPDATE public.seller_profiles
    SET is_active = false,
        settlement_eligible = false,
        razorpay_linked_account_id = NULL,
        display_name = 'Deleted seller account',
        legal_business_name = 'Deleted seller account',
        business_type = NULL,
        gstin = NULL,
        pan = NULL,
        pickup_address = NULL,
        updated_at = now()
    WHERE id = seller_profile_id;
  END IF;

  UPDATE public.buyer_profiles
  SET is_active = false,
      business_name = 'Deleted buyer account',
      business_type = NULL,
      gstin = NULL,
      gstin_verified = false,
      billing_address = NULL,
      updated_at = now()
  WHERE user_id = current_user_id;

  UPDATE public.user_profiles
  SET email = deleted_alias,
      full_name = 'Deleted FabricTrad account',
      phone = NULL,
      phone_verified = false,
      is_active = false,
      avatar_url = NULL,
      address_line1 = NULL,
      address_line2 = NULL,
      city = NULL,
      state = NULL,
      pincode = NULL,
      business_name = NULL,
      gstin = NULL,
      can_buy = false,
      can_sell = false,
      verification_status = 'unverified',
      identity_reference_last4 = NULL,
      identity_verified_at = NULL,
      updated_at = now()
  WHERE id = current_user_id;

  DELETE FROM public.onboarding_drafts WHERE user_id = current_user_id;

  -- Storage deletion is attempted by the trusted API before Auth deletion.
  -- Detaching any remaining private objects prevents the Auth foreign-key
  -- ownership check from blocking account closure while keeping them private.
  UPDATE storage.objects
  SET owner = NULL,
      owner_id = NULL,
      updated_at = now()
  WHERE owner = current_user_id OR owner_id = current_user_id::text;

  RETURN jsonb_build_object(
    'anonymized', true,
    'user_id', current_user_id,
    'seller_profile_id', seller_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_current_account_for_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_current_account_for_deletion() TO authenticated, service_role;
