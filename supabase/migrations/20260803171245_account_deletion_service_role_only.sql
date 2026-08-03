-- Account anonymisation is destructive and must only be invoked by the trusted
-- OTP-confirmation API after all marketplace blockers and warnings are checked.

REVOKE ALL ON FUNCTION public.anonymize_current_account_for_deletion()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.anonymize_account_for_deletion(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  seller_profile_id uuid;
  deleted_alias text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users account WHERE account.id = p_user_id) THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

  deleted_alias := 'deleted+' || replace(p_user_id::text, '-', '') || '@fabrictrad.invalid';

  SELECT seller.id INTO seller_profile_id
  FROM public.seller_profiles seller
  WHERE seller.user_id = p_user_id
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
  WHERE user_id = p_user_id;

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
  WHERE id = p_user_id;

  DELETE FROM public.onboarding_drafts WHERE user_id = p_user_id;

  UPDATE storage.objects
  SET owner = NULL,
      owner_id = NULL,
      updated_at = now()
  WHERE owner = p_user_id OR owner_id = p_user_id::text;

  RETURN jsonb_build_object(
    'anonymized', true,
    'user_id', p_user_id,
    'seller_profile_id', seller_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_account_for_deletion(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_account_for_deletion(uuid)
  TO service_role;
