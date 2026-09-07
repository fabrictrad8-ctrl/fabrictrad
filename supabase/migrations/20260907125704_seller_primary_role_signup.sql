-- Provision only the primary workspace on signup. Preserve existing accounts and data.
-- A seller must not first receive a buyer profile that conflicts with role guards.
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
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  requested_seller := COALESCE(NEW.raw_user_meta_data->>'role' = 'seller', FALSE)
    OR NULLIF(trim(NEW.raw_user_meta_data->>'gstin'), '') IS NOT NULL;
  normalized_phone := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'),
    ''
  );
  requested_method := CASE
    WHEN requested_seller THEN 'gstin'
    WHEN NEW.raw_user_meta_data->>'verification_method' IN ('pan', 'aadhaar_offline')
      THEN NEW.raw_user_meta_data->>'verification_method'
    ELSE 'none'
  END;
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
    CASE
      WHEN requested_method = 'gstin' THEN right(upper(NEW.raw_user_meta_data->>'gstin'), 4)
      ELSE requested_last4
    END,
    NOT requested_seller,
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
    can_buy = EXCLUDED.can_buy,
    can_sell = public.user_profiles.can_sell OR EXCLUDED.can_sell,
    updated_at = NOW();

  IF NOT requested_seller THEN
    INSERT INTO public.buyer_profiles (
      user_id, buyer_ref, business_name, business_type, gstin, billing_address, is_active
    ) VALUES (
      NEW.id,
      'FT-BYR-' || suffix,
      NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
      CASE
        WHEN requested_seller THEN NULLIF(NEW.raw_user_meta_data->>'business_type', '')
        ELSE 'Individual buyer'
      END,
      upper(NULLIF(NEW.raw_user_meta_data->>'gstin', '')),
      profile_address,
      TRUE
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF requested_seller THEN
    INSERT INTO public.seller_profiles (
      user_id, seller_ref, legal_business_name, display_name, business_type,
      gstin, pan, verification_status, pickup_address, is_active
    ) VALUES (
      NEW.id,
      'FT-SLR-' || suffix,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(NEW.email, '@', 1)
      ),
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(NEW.email, '@', 1)
      ),
      NULLIF(NEW.raw_user_meta_data->>'business_type', ''),
      upper(NULLIF(NEW.raw_user_meta_data->>'gstin', '')),
      upper(NULLIF(NEW.raw_user_meta_data->>'pan', '')),
      'registration_started'::public.seller_status,
      profile_address,
      TRUE
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF requested_method IN ('pan', 'aadhaar_offline')
     AND requested_last4 ~ '^[A-Z0-9]{4}$' THEN
    INSERT INTO public.account_verifications (user_id, method, reference_last4, status)
    VALUES (NEW.id, requested_method, requested_last4, 'pending')
    ON CONFLICT (user_id, method) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
