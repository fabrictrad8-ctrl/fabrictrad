-- FabricTrad unified commerce accounts.
-- One identity and mobile number may buy and, after GST onboarding, sell.
-- PAN / Aadhaar Offline e-KYC accounts remain buyer-only.

BEGIN;

-- ---------------------------------------------------------------------------
-- Capability-based account access
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS identity_reference_last4 TEXT,
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS can_buy BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_sell BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_account_kind_check') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_account_kind_check
      CHECK (account_kind IN ('individual', 'business'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_verification_method_check') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_verification_method_check
      CHECK (verification_method IN ('none', 'pan', 'aadhaar_offline', 'gstin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_verification_status_check') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_verification_status_check
      CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
  END IF;
END $$;

-- Preserve one account per mobile number. Normalisation makes +91/spaces/dashes irrelevant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_phone_identity_unique
  ON public.user_profiles ((right(regexp_replace(phone, '\D', '', 'g'), 10)))
  WHERE phone IS NOT NULL AND length(regexp_replace(phone, '\D', '', 'g')) >= 10;

-- Make each Auth user own at most one buyer and one seller profile.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.buyer_profiles
)
DELETE FROM public.buyer_profiles WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.seller_profiles
)
DELETE FROM public.seller_profiles WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_profiles_user_id_unique
  ON public.buyer_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_profiles_user_id_unique
  ON public.seller_profiles(user_id);

ALTER TABLE public.seller_registrations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.seller_registrations AS registration
SET user_id = profile.id
FROM public.user_profiles AS profile
WHERE registration.user_id IS NULL
  AND (
    (registration.email IS NOT NULL AND lower(registration.email) = lower(profile.email))
    OR right(regexp_replace(COALESCE(registration.phone, ''), '\D', '', 'g'), 10)
       = right(regexp_replace(COALESCE(profile.phone, ''), '\D', '', 'g'), 10)
  );

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC, id) AS rn
  FROM public.seller_registrations
  WHERE user_id IS NOT NULL
)
DELETE FROM public.seller_registrations WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_registrations_user_id_unique
  ON public.seller_registrations(user_id) WHERE user_id IS NOT NULL;

UPDATE public.user_profiles AS profile
SET can_buy = TRUE,
    can_sell = (
      profile.role = 'seller'::public.user_role
      OR NULLIF(trim(profile.gstin), '') IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.seller_profiles seller WHERE seller.user_id = profile.id)
    ),
    account_kind = CASE
      WHEN profile.role = 'seller'::public.user_role
        OR NULLIF(trim(profile.gstin), '') IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.seller_profiles seller WHERE seller.user_id = profile.id)
      THEN 'business' ELSE 'individual' END,
    verification_method = CASE
      WHEN NULLIF(trim(profile.gstin), '') IS NOT NULL THEN 'gstin'
      ELSE verification_method END,
    verification_status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.seller_profiles seller
        WHERE seller.user_id = profile.id
          AND seller.verification_status = 'verified'::public.seller_status
      ) THEN 'verified'
      WHEN NULLIF(trim(profile.gstin), '') IS NOT NULL THEN 'pending'
      ELSE verification_status END,
    updated_at = NOW();

-- Every ordinary commerce account is a buyer. GST accounts additionally receive a seller profile.
INSERT INTO public.buyer_profiles (
  user_id, buyer_ref, business_name, business_type, gstin, gstin_verified,
  billing_address, is_active, updated_at
)
SELECT
  profile.id,
  'FT-BYR-' || upper(substr(replace(profile.id::text, '-', ''), 1, 12)),
  profile.business_name,
  CASE WHEN profile.account_kind = 'business' THEN 'Business buyer' ELSE 'Individual buyer' END,
  profile.gstin,
  profile.verification_method = 'gstin' AND profile.verification_status = 'verified',
  jsonb_strip_nulls(jsonb_build_object(
    'line1', profile.address_line1,
    'line2', profile.address_line2,
    'city', profile.city,
    'state', profile.state,
    'pincode', profile.pincode,
    'country', 'India'
  )),
  profile.is_active,
  NOW()
FROM public.user_profiles profile
WHERE profile.role NOT IN ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
ON CONFLICT (user_id) DO UPDATE SET
  business_name = COALESCE(EXCLUDED.business_name, public.buyer_profiles.business_name),
  gstin = COALESCE(EXCLUDED.gstin, public.buyer_profiles.gstin),
  billing_address = COALESCE(EXCLUDED.billing_address, public.buyer_profiles.billing_address),
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO public.seller_profiles (
  user_id, seller_ref, legal_business_name, display_name, business_type, gstin,
  gstin_verified, verification_status, settlement_eligible, pickup_address,
  is_active, updated_at
)
SELECT
  profile.id,
  'FT-SLR-' || upper(substr(replace(profile.id::text, '-', ''), 1, 12)),
  COALESCE(NULLIF(profile.business_name, ''), profile.full_name, split_part(profile.email, '@', 1)),
  COALESCE(NULLIF(profile.business_name, ''), profile.full_name, split_part(profile.email, '@', 1)),
  'Business seller',
  profile.gstin,
  profile.verification_status = 'verified',
  CASE WHEN profile.verification_status = 'verified'
    THEN 'verified'::public.seller_status
    ELSE 'profile_incomplete'::public.seller_status END,
  FALSE,
  jsonb_strip_nulls(jsonb_build_object(
    'line1', profile.address_line1,
    'line2', profile.address_line2,
    'city', profile.city,
    'state', profile.state,
    'pincode', profile.pincode,
    'country', 'India'
  )),
  profile.is_active,
  NOW()
FROM public.user_profiles profile
WHERE profile.can_sell = TRUE
ON CONFLICT (user_id) DO UPDATE SET
  legal_business_name = COALESCE(NULLIF(EXCLUDED.legal_business_name, ''), public.seller_profiles.legal_business_name),
  display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.seller_profiles.display_name),
  gstin = COALESCE(EXCLUDED.gstin, public.seller_profiles.gstin),
  pickup_address = COALESCE(EXCLUDED.pickup_address, public.seller_profiles.pickup_address),
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.can_current_user_buy()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT profile.can_buy AND profile.is_active
    FROM public.user_profiles profile
    WHERE profile.id = auth.uid()
  ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.can_current_user_sell()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT profile.can_sell AND profile.is_active
    FROM public.user_profiles profile
    WHERE profile.id = auth.uid()
  ), FALSE)
  AND EXISTS (
    SELECT 1 FROM public.seller_profiles seller
    WHERE seller.user_id = auth.uid() AND seller.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.my_buyer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.buyer_profiles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_seller_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.seller_profiles WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.can_current_user_buy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_current_user_sell() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_buyer_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_seller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_current_user_buy() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_current_user_sell() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_buyer_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_seller_id() TO authenticated, service_role;

-- Review-safe identity submissions. Aadhaar numbers are never stored: only the
-- UIDAI Offline e-KYC reference's last four characters and a private file path.
CREATE TABLE IF NOT EXISTS public.account_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('pan', 'aadhaar_offline', 'gstin')),
  reference_last4 TEXT NOT NULL CHECK (reference_last4 ~ '^[A-Za-z0-9]{4}$'),
  document_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, method)
);

ALTER TABLE public.account_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_verifications_read_own ON public.account_verifications;
CREATE POLICY account_verifications_read_own ON public.account_verifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS account_verifications_submit_own ON public.account_verifications;
CREATE POLICY account_verifications_submit_own ON public.account_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL);
DROP POLICY IF EXISTS account_verifications_update_pending_own ON public.account_verifications;
CREATE POLICY account_verifications_update_pending_own ON public.account_verifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL);
DROP POLICY IF EXISTS account_verifications_admin_manage ON public.account_verifications;
CREATE POLICY account_verifications_admin_manage ON public.account_verifications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.account_verifications (user_id, method, reference_last4, status, reviewed_at)
SELECT id, verification_method, identity_reference_last4,
  CASE WHEN verification_status = 'verified' THEN 'verified' ELSE 'pending' END,
  identity_verified_at
FROM public.user_profiles
WHERE verification_method IN ('pan', 'aadhaar_offline', 'gstin')
  AND identity_reference_last4 ~ '^[A-Za-z0-9]{4}$'
ON CONFLICT (user_id, method) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-verification-documents',
  'identity-verification-documents',
  FALSE,
  10485760,
  ARRAY['application/pdf','application/xml','text/xml','application/zip','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS identity_verification_owner_upload ON storage.objects;
CREATE POLICY identity_verification_owner_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'identity-verification-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS identity_verification_owner_read ON storage.objects;
CREATE POLICY identity_verification_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'identity-verification-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS identity_verification_owner_update ON storage.objects;
CREATE POLICY identity_verification_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'identity-verification-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()))
  WITH CHECK (bucket_id = 'identity-verification-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS identity_verification_owner_delete ON storage.objects;
CREATE POLICY identity_verification_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'identity-verification-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

CREATE OR REPLACE FUNCTION public.request_seller_access(p_payload JSONB)
RETURNS TABLE (seller_profile_id UUID, registration_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_gstin TEXT := upper(trim(COALESCE(p_payload->>'gstin', '')));
  normalized_phone TEXT;
  seller_record_id UUID;
  registration_record_id UUID;
  seller_reference TEXT;
  business_name TEXT;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF normalized_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RAISE EXCEPTION 'Enter a valid GSTIN before activating seller access';
  END IF;

  SELECT regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
  INTO normalized_phone FROM public.user_profiles WHERE id = current_user_id;
  business_name := COALESCE(NULLIF(trim(p_payload->>'businessName'), ''), NULLIF(trim(p_payload->>'ownerName'), ''), 'FabricTrad Seller');
  seller_reference := 'FT-SLR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12));

  PERFORM set_config('fabrictrad.trusted_capability_change', '1', true);
  UPDATE public.user_profiles
  SET can_buy = TRUE,
      can_sell = TRUE,
      account_kind = 'business',
      verification_method = 'gstin',
      verification_status = 'pending',
      identity_reference_last4 = right(normalized_gstin, 4),
      business_name = business_name,
      gstin = normalized_gstin,
      address_line1 = COALESCE(NULLIF(trim(p_payload->>'address'), ''), address_line1),
      city = COALESCE(NULLIF(trim(p_payload->>'city'), ''), city),
      state = COALESCE(NULLIF(trim(p_payload->>'state'), ''), state),
      pincode = COALESCE(NULLIF(trim(p_payload->>'pincode'), ''), pincode),
      updated_at = NOW()
  WHERE id = current_user_id;

  INSERT INTO public.buyer_profiles (user_id, buyer_ref, business_name, business_type, gstin, billing_address, is_active)
  VALUES (
    current_user_id,
    'FT-BYR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12)),
    business_name,
    COALESCE(NULLIF(trim(p_payload->>'businessType'), ''), 'Business buyer'),
    normalized_gstin,
    jsonb_strip_nulls(jsonb_build_object(
      'line1', NULLIF(trim(p_payload->>'address'), ''),
      'city', NULLIF(trim(p_payload->>'city'), ''),
      'state', NULLIF(trim(p_payload->>'state'), ''),
      'pincode', NULLIF(trim(p_payload->>'pincode'), ''),
      'country', 'India'
    )),
    TRUE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_type = EXCLUDED.business_type,
    gstin = EXCLUDED.gstin,
    billing_address = EXCLUDED.billing_address,
    is_active = TRUE,
    updated_at = NOW();

  INSERT INTO public.seller_profiles (
    user_id, seller_ref, legal_business_name, display_name, business_type, gstin, pan,
    verification_status, pickup_address, is_active
  ) VALUES (
    current_user_id,
    seller_reference,
    business_name,
    business_name,
    NULLIF(trim(p_payload->>'businessType'), ''),
    normalized_gstin,
    upper(NULLIF(trim(p_payload->>'pan'), '')),
    'profile_incomplete'::public.seller_status,
    jsonb_strip_nulls(jsonb_build_object(
      'line1', NULLIF(trim(p_payload->>'address'), ''),
      'city', NULLIF(trim(p_payload->>'city'), ''),
      'state', NULLIF(trim(p_payload->>'state'), ''),
      'pincode', NULLIF(trim(p_payload->>'pincode'), ''),
      'country', 'India'
    )),
    TRUE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    legal_business_name = EXCLUDED.legal_business_name,
    display_name = EXCLUDED.display_name,
    business_type = EXCLUDED.business_type,
    gstin = EXCLUDED.gstin,
    pan = COALESCE(EXCLUDED.pan, public.seller_profiles.pan),
    pickup_address = EXCLUDED.pickup_address,
    is_active = TRUE,
    updated_at = NOW()
  RETURNING id INTO seller_record_id;

  INSERT INTO public.seller_registrations (
    user_id, seller_id, phone, owner_name, email, business_name, business_type,
    city, state, pincode, address, categories, monthly_capacity, gstin, pan,
    bank_account_number, bank_ifsc, bank_account_name, bank_name,
    registration_status, submitted_at, updated_at
  )
  SELECT
    current_user_id,
    seller_reference,
    right(normalized_phone, 10),
    NULLIF(trim(p_payload->>'ownerName'), ''),
    profile.email,
    business_name,
    NULLIF(trim(p_payload->>'businessType'), ''),
    NULLIF(trim(p_payload->>'city'), ''),
    NULLIF(trim(p_payload->>'state'), ''),
    NULLIF(trim(p_payload->>'pincode'), ''),
    NULLIF(trim(p_payload->>'address'), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'categories', '[]'::jsonb))), '{}'::TEXT[]),
    NULLIF(trim(p_payload->>'monthlyCapacity'), ''),
    normalized_gstin,
    upper(NULLIF(trim(p_payload->>'pan'), '')),
    NULLIF(trim(p_payload->>'bankAccountNumberMasked'), ''),
    upper(NULLIF(trim(p_payload->>'bankIfsc'), '')),
    NULLIF(trim(p_payload->>'bankAccountName'), ''),
    NULLIF(trim(p_payload->>'bankName'), ''),
    'under_review',
    NOW(),
    NOW()
  FROM public.user_profiles profile WHERE profile.id = current_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    phone = EXCLUDED.phone,
    owner_name = EXCLUDED.owner_name,
    email = EXCLUDED.email,
    business_name = EXCLUDED.business_name,
    business_type = EXCLUDED.business_type,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    pincode = EXCLUDED.pincode,
    address = EXCLUDED.address,
    categories = EXCLUDED.categories,
    monthly_capacity = EXCLUDED.monthly_capacity,
    gstin = EXCLUDED.gstin,
    pan = EXCLUDED.pan,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc = EXCLUDED.bank_ifsc,
    bank_account_name = EXCLUDED.bank_account_name,
    bank_name = EXCLUDED.bank_name,
    registration_status = 'under_review',
    submitted_at = NOW(),
    rejection_reason = NULL,
    updated_at = NOW()
  RETURNING id INTO registration_record_id;

  INSERT INTO public.account_verifications (user_id, method, reference_last4, status)
  VALUES (current_user_id, 'gstin', right(normalized_gstin, 4), 'pending')
  ON CONFLICT (user_id, method) DO UPDATE SET
    reference_last4 = EXCLUDED.reference_last4,
    status = 'pending',
    submitted_at = NOW(),
    reviewed_at = NULL,
    reviewed_by = NULL,
    review_notes = NULL,
    updated_at = NOW();

  RETURN QUERY SELECT seller_record_id, registration_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_seller_access(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_seller_access(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_user_profile_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin()
     OR current_setting('fabrictrad.trusted_capability_change', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.can_buy IS DISTINCT FROM OLD.can_buy
     OR NEW.can_sell IS DISTINCT FROM OLD.can_sell
     OR NEW.account_kind IS DISTINCT FROM OLD.account_kind
     OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.identity_reference_last4 IS DISTINCT FROM OLD.identity_reference_last4
     OR NEW.identity_verified_at IS DISTINCT FROM OLD.identity_verified_at THEN
    RAISE EXCEPTION 'Account capabilities and verification are managed by FabricTrad';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_profile_capabilities_trigger ON public.user_profiles;
CREATE TRIGGER protect_user_profile_capabilities_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_capabilities();

-- Auth trigger: every normal account receives buying access; GST/seller onboarding
-- additionally creates a seller profile without requiring a second identity.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_seller BOOLEAN;
  normalized_phone TEXT;
  requested_method TEXT;
  requested_last4 TEXT;
  profile_address JSONB;
  suffix TEXT;
BEGIN
  requested_seller := NEW.raw_user_meta_data->>'role' = 'seller'
    OR NULLIF(trim(NEW.raw_user_meta_data->>'gstin'), '') IS NOT NULL;
  normalized_phone := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '');
  requested_method := CASE
    WHEN requested_seller THEN 'gstin'
    WHEN NEW.raw_user_meta_data->>'verification_method' IN ('pan', 'aadhaar_offline')
      THEN NEW.raw_user_meta_data->>'verification_method'
    ELSE 'none' END;
  requested_last4 := upper(NULLIF(trim(NEW.raw_user_meta_data->>'identity_reference_last4'), ''));
  suffix := upper(substr(replace(NEW.id::text, '-', ''), 1, 12));
  profile_address := jsonb_strip_nulls(jsonb_build_object(
    'line1', NULLIF(NEW.raw_user_meta_data->>'address_line1', ''),
    'line2', NULLIF(NEW.raw_user_meta_data->>'address_line2', ''),
    'city', NULLIF(NEW.raw_user_meta_data->>'city', ''),
    'state', NULLIF(NEW.raw_user_meta_data->>'state', ''),
    'pincode', NULLIF(NEW.raw_user_meta_data->>'pincode', ''),
    'country', 'India'
  ));

  INSERT INTO public.user_profiles (
    id, email, full_name, avatar_url, phone, role, business_name, gstin,
    address_line1, address_line2, city, state, pincode,
    account_kind, verification_method, verification_status,
    identity_reference_last4, can_buy, can_sell, is_active
  ) VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    normalized_phone,
    CASE WHEN requested_seller THEN 'seller'::public.user_role ELSE 'buyer'::public.user_role END,
    NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
    upper(NULLIF(NEW.raw_user_meta_data->>'gstin', '')),
    NULLIF(NEW.raw_user_meta_data->>'address_line1', ''),
    NULLIF(NEW.raw_user_meta_data->>'address_line2', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'pincode', ''),
    CASE WHEN requested_seller THEN 'business' ELSE 'individual' END,
    requested_method,
    CASE WHEN requested_method = 'none' THEN 'unverified' ELSE 'pending' END,
    CASE WHEN requested_method = 'gstin' THEN right(upper(NEW.raw_user_meta_data->>'gstin'), 4) ELSE requested_last4 END,
    TRUE,
    requested_seller,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    business_name = COALESCE(EXCLUDED.business_name, public.user_profiles.business_name),
    gstin = COALESCE(EXCLUDED.gstin, public.user_profiles.gstin),
    can_buy = TRUE,
    can_sell = public.user_profiles.can_sell OR EXCLUDED.can_sell,
    updated_at = NOW();

  INSERT INTO public.buyer_profiles (
    user_id, buyer_ref, business_name, business_type, gstin, billing_address, is_active
  ) VALUES (
    NEW.id,
    'FT-BYR-' || suffix,
    NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
    CASE WHEN requested_seller THEN NULLIF(NEW.raw_user_meta_data->>'business_type', '') ELSE 'Individual buyer' END,
    upper(NULLIF(NEW.raw_user_meta_data->>'gstin', '')),
    profile_address,
    TRUE
  ) ON CONFLICT (user_id) DO NOTHING;

  IF requested_seller THEN
    INSERT INTO public.seller_profiles (
      user_id, seller_ref, legal_business_name, display_name, business_type,
      gstin, pan, verification_status, pickup_address, is_active
    ) VALUES (
      NEW.id,
      'FT-SLR-' || suffix,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
      NULLIF(NEW.raw_user_meta_data->>'business_type', ''),
      upper(NULLIF(NEW.raw_user_meta_data->>'gstin', '')),
      upper(NULLIF(NEW.raw_user_meta_data->>'pan', '')),
      'registration_started'::public.seller_status,
      profile_address,
      TRUE
    ) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF requested_method IN ('pan', 'aadhaar_offline') AND requested_last4 ~ '^[A-Z0-9]{4}$' THEN
    INSERT INTO public.account_verifications (user_id, method, reference_last4, status)
    VALUES (NEW.id, requested_method, requested_last4, 'pending')
    ON CONFLICT (user_id, method) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Product catalogue schema (idempotent production repair)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  sku TEXT NOT NULL CHECK (char_length(trim(sku)) BETWEEN 1 AND 80),
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT,
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  unit TEXT NOT NULL DEFAULT 'mtr' CHECK (unit IN ('mtr','kg','piece','roll')),
  available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  min_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  moq INTEGER NOT NULL DEFAULT 3 CHECK (moq >= 1),
  gsm INTEGER CHECK (gsm IS NULL OR gsm > 0),
  width_inches NUMERIC(7,2) CHECK (width_inches IS NULL OR width_inches > 0),
  work_type TEXT NOT NULL DEFAULT 'Plain',
  image_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispatch_days INTEGER NOT NULL DEFAULT 3 CHECK (dispatch_days BETWEEN 1 AND 30),
  origin_city TEXT,
  origin_state TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv','whatsapp','assistant')),
  source_reference TEXT,
  approval_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (approval_status IN ('not_submitted','pending','approved','rejected')),
  admin_review_notes TEXT,
  sale_channel TEXT NOT NULL DEFAULT 'b2b' CHECK (sale_channel IN ('b2b','retail','both')),
  package_format TEXT NOT NULL DEFAULT 'Fabric Only' CHECK (package_format IN ('Fabric Only','Full Set','Top','Bottom','Top & Bottom','Additional Accessory','Other')),
  variant_count INTEGER NOT NULL DEFAULT 0,
  variant_colors TEXT[] NOT NULL DEFAULT '{}',
  variant_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_terms TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, sku)
);

ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS admin_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS sale_channel TEXT NOT NULL DEFAULT 'b2b',
  ADD COLUMN IF NOT EXISTS package_format TEXT NOT NULL DEFAULT 'Fabric Only',
  ADD COLUMN IF NOT EXISTS variant_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variant_colors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS variant_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_terms TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_products_source_reference
  ON public.seller_products(source, source_reference) WHERE source_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seller_products_seller_id ON public.seller_products(seller_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_products_public ON public.seller_products(status, sale_channel, updated_at DESC);
ALTER TABLE public.seller_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_active_seller_products ON public.seller_products;
CREATE POLICY public_read_active_seller_products ON public.seller_products
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active' AND approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.seller_profiles seller
      WHERE seller.id = seller_id AND seller.is_active = TRUE
        AND seller.verification_status = 'verified'::public.seller_status
    )
  );
DROP POLICY IF EXISTS sellers_manage_own_products ON public.seller_products;
CREATE POLICY sellers_manage_own_products ON public.seller_products
  FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id() AND public.can_current_user_sell())
  WITH CHECK (seller_id = public.my_seller_id() AND public.can_current_user_sell());
DROP POLICY IF EXISTS admins_manage_seller_products ON public.seller_products;
CREATE POLICY admins_manage_seller_products ON public.seller_products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS seller_products_updated_at ON public.seller_products;
CREATE TRIGGER seller_products_updated_at BEFORE UPDATE ON public.seller_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.seller_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  variant_code TEXT NOT NULL,
  color_name TEXT NOT NULL CHECK (char_length(trim(color_name)) BETWEEN 1 AND 100),
  color_hex TEXT CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  design_name TEXT NOT NULL DEFAULT 'Standard',
  description TEXT,
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  unit TEXT NOT NULL DEFAULT 'mtr' CHECK (unit IN ('mtr','kg','piece','roll')),
  available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  moq NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (moq > 0),
  image_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv','whatsapp','assistant')),
  source_reference TEXT,
  approval_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (approval_status IN ('not_submitted','pending','approved','rejected')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  admin_review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, variant_key),
  UNIQUE (seller_id, variant_code)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.seller_product_variants(product_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_variants_seller ON public.seller_product_variants(seller_id, updated_at DESC);
ALTER TABLE public.seller_product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_active_product_variants ON public.seller_product_variants;
CREATE POLICY public_read_active_product_variants ON public.seller_product_variants
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active' AND approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.seller_products product
      JOIN public.seller_profiles seller ON seller.id = product.seller_id
      WHERE product.id = product_id AND product.seller_id = seller_id
        AND product.status = 'active' AND product.approval_status = 'approved'
        AND seller.is_active = TRUE AND seller.verification_status = 'verified'::public.seller_status
    )
  );
DROP POLICY IF EXISTS sellers_manage_own_product_variants ON public.seller_product_variants;
CREATE POLICY sellers_manage_own_product_variants ON public.seller_product_variants
  FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id() AND public.can_current_user_sell())
  WITH CHECK (
    seller_id = public.my_seller_id() AND public.can_current_user_sell()
    AND EXISTS (SELECT 1 FROM public.seller_products product WHERE product.id = product_id AND product.seller_id = seller_id)
  );
DROP POLICY IF EXISTS admins_manage_product_variants ON public.seller_product_variants;
CREATE POLICY admins_manage_product_variants ON public.seller_product_variants
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS seller_product_variants_updated_at ON public.seller_product_variants;
CREATE TRIGGER seller_product_variants_updated_at BEFORE UPDATE ON public.seller_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_product_variant_rollup(p_product_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rollup RECORD;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status <> 'archived')::INTEGER AS variant_count,
    COALESCE(ARRAY_AGG(DISTINCT color_name ORDER BY color_name) FILTER (WHERE status <> 'archived'), '{}'::TEXT[]) AS colors,
    COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', id, 'color', color_name, 'colorHex', color_hex, 'design', design_name,
      'price', price_per_unit, 'unit', unit,
      'available', GREATEST(available_quantity - reserved_quantity, 0),
      'moq', moq, 'image', image_url, 'status', status, 'approvalStatus', approval_status
    ) ORDER BY color_name, design_name) FILTER (WHERE status <> 'archived'), '[]'::JSONB) AS summary,
    COALESCE(SUM(GREATEST(available_quantity - reserved_quantity, 0)) FILTER (WHERE status <> 'archived'), 0) AS total_available,
    MIN(price_per_unit) FILTER (WHERE status <> 'archived') AS minimum_price,
    MIN(image_url) FILTER (WHERE status <> 'archived' AND image_url IS NOT NULL) AS first_image,
    COALESCE(STRING_AGG(DISTINCT trim(color_name || ' ' || design_name || ' ' || COALESCE(description, '')), ' ') FILTER (WHERE status <> 'archived'), '') AS variant_search
  INTO rollup FROM public.seller_product_variants WHERE product_id = p_product_id;

  UPDATE public.seller_products
  SET variant_count = COALESCE(rollup.variant_count, 0),
      variant_colors = COALESCE(rollup.colors, '{}'::TEXT[]),
      variant_summary = COALESCE(rollup.summary, '[]'::JSONB),
      search_terms = trim(COALESCE(name,'') || ' ' || COALESCE(category,'') || ' ' || COALESCE(work_type,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(rollup.variant_search,'')),
      available_quantity = CASE WHEN COALESCE(rollup.variant_count, 0) > 0 THEN COALESCE(rollup.total_available, 0) ELSE available_quantity END,
      price_per_unit = CASE WHEN COALESCE(rollup.variant_count, 0) > 0 AND rollup.minimum_price IS NOT NULL THEN rollup.minimum_price ELSE price_per_unit END,
      image_url = COALESCE(image_url, rollup.first_image),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_variant_rollup_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.sync_product_variant_rollup(COALESCE(NEW.product_id, OLD.product_id));
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM public.sync_product_variant_rollup(OLD.product_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS seller_product_variants_rollup ON public.seller_product_variants;
CREATE TRIGGER seller_product_variants_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.seller_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_variant_rollup_trigger();

CREATE TABLE IF NOT EXISTS public.seller_product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.seller_product_variants(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  view_type TEXT NOT NULL DEFAULT 'other' CHECK (view_type IN ('front','back','detail','reel','other')),
  public_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 52428800),
  duration_seconds NUMERIC(6,2) CHECK (duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 20.5)),
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, storage_path)
);
ALTER TABLE public.seller_product_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_active_product_media ON public.seller_product_media;
CREATE POLICY public_read_active_product_media ON public.seller_product_media
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.seller_products product
    JOIN public.seller_profiles seller ON seller.id = product.seller_id
    WHERE product.id = product_id AND product.seller_id = seller_id
      AND product.status = 'active' AND product.approval_status = 'approved'
      AND seller.is_active = TRUE AND seller.verification_status = 'verified'::public.seller_status
  ));
DROP POLICY IF EXISTS sellers_manage_own_product_media ON public.seller_product_media;
CREATE POLICY sellers_manage_own_product_media ON public.seller_product_media
  FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id() AND public.can_current_user_sell())
  WITH CHECK (seller_id = public.my_seller_id() AND public.can_current_user_sell());
DROP POLICY IF EXISTS admins_manage_product_media ON public.seller_product_media;
CREATE POLICY admins_manage_product_media ON public.seller_product_media
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS seller_product_media_updated_at ON public.seller_product_media;
CREATE TRIGGER seller_product_media_updated_at BEFORE UPDATE ON public.seller_product_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-product-media','seller-product-media',TRUE,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
ON CONFLICT (id) DO UPDATE SET public=TRUE,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS seller_product_media_owner_upload ON storage.objects;
CREATE POLICY seller_product_media_owner_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='seller-product-media' AND (storage.foldername(name))[1]=auth.uid()::text AND public.can_current_user_sell());
DROP POLICY IF EXISTS seller_product_media_owner_update ON storage.objects;
CREATE POLICY seller_product_media_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='seller-product-media' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()))
  WITH CHECK (bucket_id='seller-product-media' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS seller_product_media_public_read ON storage.objects;
CREATE POLICY seller_product_media_public_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id='seller-product-media');
DROP POLICY IF EXISTS seller_product_media_owner_delete ON storage.objects;
CREATE POLICY seller_product_media_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='seller-product-media' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));

-- ---------------------------------------------------------------------------
-- Retail and B2B direct orders + Razorpay ledgers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.seller_product_variants(id) ON DELETE SET NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('mtr','kg','piece','roll')),
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal > 0),
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled','paid','fulfilled')),
  notes TEXT,
  payment_due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_catalog_order_requests_buyer ON public.catalog_order_requests(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_order_requests_seller ON public.catalog_order_requests(seller_id, status, created_at DESC);
ALTER TABLE public.catalog_order_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buyers_create_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_create_catalog_order_requests ON public.catalog_order_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid() AND public.can_current_user_buy() AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.seller_products product
      WHERE product.id = product_id AND product.seller_id = seller_id
        AND product.status = 'active' AND product.approval_status = 'approved'
        AND (product.sale_channel IN ('retail','both') OR quantity >= product.moq)
        AND quantity <= GREATEST(product.available_quantity - product.reserved_quantity, 0)
    )
  );
DROP POLICY IF EXISTS buyers_read_own_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_read_own_catalog_order_requests ON public.catalog_order_requests
  FOR SELECT TO authenticated USING (buyer_id=auth.uid());
DROP POLICY IF EXISTS buyers_cancel_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_cancel_catalog_order_requests ON public.catalog_order_requests
  FOR UPDATE TO authenticated
  USING (buyer_id=auth.uid() AND status IN ('pending','accepted'))
  WITH CHECK (buyer_id=auth.uid() AND status='cancelled');
DROP POLICY IF EXISTS sellers_read_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY sellers_read_catalog_order_requests ON public.catalog_order_requests
  FOR SELECT TO authenticated USING (seller_id=public.my_seller_id() AND public.can_current_user_sell());
DROP POLICY IF EXISTS sellers_update_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY sellers_update_catalog_order_requests ON public.catalog_order_requests
  FOR UPDATE TO authenticated
  USING (seller_id=public.my_seller_id() AND public.can_current_user_sell())
  WITH CHECK (seller_id=public.my_seller_id() AND public.can_current_user_sell());
DROP POLICY IF EXISTS admins_manage_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY admins_manage_catalog_order_requests ON public.catalog_order_requests
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS catalog_order_requests_updated_at ON public.catalog_order_requests;
CREATE TRIGGER catalog_order_requests_updated_at BEFORE UPDATE ON public.catalog_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.protect_catalog_order_request_state()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_seller_id UUID;
BEGIN
  IF auth.role()='service_role' OR public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.variant_id IS DISTINCT FROM OLD.variant_id
    OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.unit IS DISTINCT FROM OLD.unit
    OR NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.gst_amount IS DISTINCT FROM OLD.gst_amount OR NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
    RAISE EXCEPTION 'Order ownership, products, quantities and totals cannot be changed';
  END IF;
  IF auth.uid()=OLD.buyer_id AND public.can_current_user_buy() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      AND NOT (OLD.status IN ('pending','accepted') AND NEW.status='cancelled') THEN
      RAISE EXCEPTION 'Buyer is not allowed to set this order status';
    END IF;
    RETURN NEW;
  END IF;
  actor_seller_id := public.my_seller_id();
  IF actor_seller_id=OLD.seller_id AND public.can_current_user_sell() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      AND NOT ((OLD.status='pending' AND NEW.status IN ('accepted','rejected')) OR (OLD.status='paid' AND NEW.status='fulfilled')) THEN
      RAISE EXCEPTION 'Seller is not allowed to set this order status';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Not authorized to update this order';
END;
$$;
DROP TRIGGER IF EXISTS protect_catalog_order_request_state_trigger ON public.catalog_order_requests;
CREATE TRIGGER protect_catalog_order_request_state_trigger BEFORE UPDATE ON public.catalog_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_catalog_order_request_state();

CREATE TABLE IF NOT EXISTS public.catalog_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_order_id UUID NOT NULL REFERENCES public.catalog_order_requests(id) ON DELETE RESTRICT,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','authorized','captured','failed','refunded')),
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
CREATE INDEX IF NOT EXISTS idx_catalog_order_payments_order ON public.catalog_order_payments(catalog_order_id, created_at DESC);
ALTER TABLE public.catalog_order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buyers_read_own_catalog_order_payments ON public.catalog_order_payments;
CREATE POLICY buyers_read_own_catalog_order_payments ON public.catalog_order_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_order_requests request WHERE request.id=catalog_order_id AND request.buyer_id=auth.uid()));
DROP POLICY IF EXISTS sellers_read_catalog_order_payments ON public.catalog_order_payments;
CREATE POLICY sellers_read_catalog_order_payments ON public.catalog_order_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_order_requests request WHERE request.id=catalog_order_id AND request.seller_id=public.my_seller_id()));
DROP POLICY IF EXISTS admins_manage_catalog_order_payments ON public.catalog_order_payments;
CREATE POLICY admins_manage_catalog_order_payments ON public.catalog_order_payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS catalog_order_payments_updated_at ON public.catalog_order_payments;
CREATE TRIGGER catalog_order_payments_updated_at BEFORE UPDATE ON public.catalog_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bulk_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_order_id UUID NOT NULL REFERENCES public.bulk_orders(id) ON DELETE RESTRICT,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','authorized','captured','failed','refunded')),
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
ALTER TABLE public.bulk_order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS buyers_read_own_bulk_order_payments ON public.bulk_order_payments;
CREATE POLICY buyers_read_own_bulk_order_payments ON public.bulk_order_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bulk_orders request WHERE request.id=bulk_order_id AND request.buyer_id=auth.uid()));
DROP POLICY IF EXISTS sellers_read_assigned_bulk_order_payments ON public.bulk_order_payments;
CREATE POLICY sellers_read_assigned_bulk_order_payments ON public.bulk_order_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bulk_orders request WHERE request.id=bulk_order_id AND request.seller_id=public.my_seller_id()));
DROP POLICY IF EXISTS admins_manage_bulk_order_payments ON public.bulk_order_payments;
CREATE POLICY admins_manage_bulk_order_payments ON public.bulk_order_payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.seller_decide_catalog_order(p_order_id UUID,p_action TEXT,p_reason TEXT DEFAULT NULL)
RETURNS public.catalog_order_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_row public.catalog_order_requests%ROWTYPE; seller_profile_id UUID; available_stock NUMERIC(12,2);
BEGIN
  seller_profile_id:=public.my_seller_id();
  IF seller_profile_id IS NULL OR NOT public.can_current_user_sell() THEN RAISE EXCEPTION 'Seller access is required'; END IF;
  IF p_action NOT IN ('accept','reject') THEN RAISE EXCEPTION 'Unsupported order action'; END IF;
  SELECT * INTO request_row FROM public.catalog_order_requests
    WHERE id=p_order_id AND seller_id=seller_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order request not found'; END IF;
  IF request_row.status<>'pending' THEN RAISE EXCEPTION 'Only pending order requests can be decided'; END IF;
  IF p_action='reject' THEN
    UPDATE public.catalog_order_requests SET status='rejected',notes=concat_ws(E'\n',NULLIF(notes,''),'Seller rejection: '||COALESCE(NULLIF(trim(p_reason),''),'Unable to fulfil this request.')),updated_at=NOW()
      WHERE id=p_order_id RETURNING * INTO request_row;
    RETURN request_row;
  END IF;
  IF request_row.variant_id IS NOT NULL THEN
    SELECT available_quantity INTO available_stock FROM public.seller_product_variants
      WHERE id=request_row.variant_id AND product_id=request_row.product_id AND seller_id=seller_profile_id FOR UPDATE;
    IF NOT FOUND OR available_stock<request_row.quantity THEN RAISE EXCEPTION 'Not enough stock is available for this variation'; END IF;
    UPDATE public.seller_product_variants SET available_quantity=available_quantity-request_row.quantity,updated_at=NOW() WHERE id=request_row.variant_id;
  ELSE
    SELECT available_quantity INTO available_stock FROM public.seller_products
      WHERE id=request_row.product_id AND seller_id=seller_profile_id FOR UPDATE;
    IF NOT FOUND OR available_stock<request_row.quantity THEN RAISE EXCEPTION 'Not enough stock is available for this product'; END IF;
    UPDATE public.seller_products SET available_quantity=available_quantity-request_row.quantity,updated_at=NOW() WHERE id=request_row.product_id;
  END IF;
  UPDATE public.catalog_order_requests SET status='accepted',payment_due_at=NOW()+interval '48 hours',notes=concat_ws(E'\n',NULLIF(notes,''),CASE WHEN NULLIF(trim(p_reason),'') IS NULL THEN 'Seller accepted the requested quantity.' ELSE 'Seller acceptance note: '||trim(p_reason) END),updated_at=NOW()
    WHERE id=p_order_id RETURNING * INTO request_row;
  RETURN request_row;
END;
$$;
REVOKE ALL ON FUNCTION public.seller_decide_catalog_order(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_decide_catalog_order(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_catalog_order_stock_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.status='accepted' AND NEW.status='cancelled' THEN
    IF OLD.variant_id IS NOT NULL THEN
      UPDATE public.seller_product_variants SET available_quantity=available_quantity+OLD.quantity,updated_at=NOW()
        WHERE id=OLD.variant_id AND product_id=OLD.product_id AND seller_id=OLD.seller_id;
    ELSE
      UPDATE public.seller_products SET available_quantity=available_quantity+OLD.quantity,updated_at=NOW()
        WHERE id=OLD.product_id AND seller_id=OLD.seller_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS restore_catalog_order_stock_on_cancel_trigger ON public.catalog_order_requests;
CREATE TRIGGER restore_catalog_order_stock_on_cancel_trigger AFTER UPDATE OF status ON public.catalog_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.restore_catalog_order_stock_on_cancel();

-- Seller registration ownership and private onboarding documents.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('seller-registration-documents','seller-registration-documents',FALSE,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=FALSE,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
ALTER TABLE public.seller_registration_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seller_owns_registration_documents ON public.seller_registration_documents;
CREATE POLICY seller_owns_registration_documents ON public.seller_registration_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seller_registrations registration WHERE registration.id=registration_id AND registration.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seller_registrations registration WHERE registration.id=registration_id AND registration.user_id=auth.uid()));
DROP POLICY IF EXISTS admin_manages_registration_documents ON public.seller_registration_documents;
CREATE POLICY admin_manages_registration_documents ON public.seller_registration_documents FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS seller_registration_document_owner_upload ON storage.objects;
CREATE POLICY seller_registration_document_owner_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='seller-registration-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS seller_registration_document_owner_read ON storage.objects;
CREATE POLICY seller_registration_document_owner_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='seller-registration-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS seller_registration_document_owner_update ON storage.objects;
CREATE POLICY seller_registration_document_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='seller-registration-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()))
  WITH CHECK (bucket_id='seller-registration-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS seller_registration_document_owner_delete ON storage.objects;
CREATE POLICY seller_registration_document_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='seller-registration-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));

GRANT SELECT ON public.seller_products, public.seller_product_variants, public.seller_product_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seller_products, public.seller_product_variants, public.seller_product_media TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.catalog_order_requests TO authenticated;
GRANT SELECT ON public.catalog_order_payments, public.bulk_order_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_verifications TO authenticated;
GRANT ALL ON public.seller_products, public.seller_product_variants, public.seller_product_media,
  public.catalog_order_requests, public.catalog_order_payments, public.bulk_order_payments,
  public.account_verifications TO service_role;

COMMIT;
