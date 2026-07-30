-- Guarantee that every auth account has the role-specific profile required by
-- inventory, marketplace orders and dashboards. Also repairs accounts created
-- before this migration.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role public.user_role;
  normalized_phone text;
  preferred_language_value text;
  preferred_theme_value text;
  profile_address jsonb;
  reference_suffix text;
BEGIN
  requested_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'seller' THEN 'seller'::public.user_role
    ELSE 'buyer'::public.user_role
  END;

  normalized_phone := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'),
    ''
  );
  IF normalized_phone IS NOT NULL
     AND (length(normalized_phone) <> 10 OR normalized_phone !~ '^[6-9]') THEN
    RAISE EXCEPTION 'A valid 10 digit Indian phone number is required';
  END IF;

  preferred_language_value := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te')
      THEN NEW.raw_user_meta_data->>'preferred_language'
    ELSE 'en'
  END;
  preferred_theme_value := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_theme' IN ('light', 'dark', 'system')
      THEN NEW.raw_user_meta_data->>'preferred_theme'
    ELSE 'system'
  END;

  profile_address := jsonb_strip_nulls(jsonb_build_object(
    'line1', NULLIF(NEW.raw_user_meta_data->>'address_line1', ''),
    'line2', NULLIF(NEW.raw_user_meta_data->>'address_line2', ''),
    'city', NULLIF(NEW.raw_user_meta_data->>'city', ''),
    'state', NULLIF(NEW.raw_user_meta_data->>'state', ''),
    'pincode', NULLIF(NEW.raw_user_meta_data->>'pincode', ''),
    'country', 'India'
  ));
  reference_suffix := upper(substr(replace(NEW.id::text, '-', ''), 1, 12));

  INSERT INTO public.user_profiles (
    id, email, full_name, avatar_url, phone, role, business_name, gstin,
    address_line1, address_line2, city, state, pincode,
    preferred_language, preferred_theme
  )
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    normalized_phone,
    requested_role,
    NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
    NULLIF(upper(NEW.raw_user_meta_data->>'gstin'), ''),
    NULLIF(NEW.raw_user_meta_data->>'address_line1', ''),
    NULLIF(NEW.raw_user_meta_data->>'address_line2', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'pincode', ''),
    preferred_language_value,
    preferred_theme_value
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    business_name = COALESCE(EXCLUDED.business_name, public.user_profiles.business_name),
    gstin = COALESCE(EXCLUDED.gstin, public.user_profiles.gstin),
    address_line1 = COALESCE(EXCLUDED.address_line1, public.user_profiles.address_line1),
    address_line2 = COALESCE(EXCLUDED.address_line2, public.user_profiles.address_line2),
    city = COALESCE(EXCLUDED.city, public.user_profiles.city),
    state = COALESCE(EXCLUDED.state, public.user_profiles.state),
    pincode = COALESCE(EXCLUDED.pincode, public.user_profiles.pincode),
    preferred_language = EXCLUDED.preferred_language,
    preferred_theme = EXCLUDED.preferred_theme,
    updated_at = CURRENT_TIMESTAMP;

  IF requested_role = 'seller'::public.user_role THEN
    INSERT INTO public.seller_profiles (
      user_id, seller_ref, legal_business_name, display_name, business_type,
      gstin, gstin_verified, pan, verification_status, settlement_eligible,
      pickup_address, is_active
    )
    SELECT
      NEW.id,
      'FT-SLR-' || reference_suffix,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
      NULLIF(NEW.raw_user_meta_data->>'business_type', ''),
      NULLIF(upper(NEW.raw_user_meta_data->>'gstin'), ''),
      false,
      NULLIF(upper(NEW.raw_user_meta_data->>'pan'), ''),
      'registration_started'::public.seller_status,
      false,
      profile_address,
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.seller_profiles WHERE user_id = NEW.id
    );
  ELSE
    INSERT INTO public.buyer_profiles (
      user_id, buyer_ref, business_name, business_type, gstin,
      gstin_verified, billing_address, is_active
    )
    SELECT
      NEW.id,
      'FT-BYR-' || reference_suffix,
      NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'business_type', ''),
      NULLIF(upper(NEW.raw_user_meta_data->>'gstin'), ''),
      false,
      profile_address,
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.buyer_profiles WHERE user_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill shared profiles for any auth users whose older signup trigger failed.
INSERT INTO public.user_profiles (
  id, email, full_name, avatar_url, phone, role, business_name, gstin,
  address_line1, address_line2, city, state, pincode,
  preferred_language, preferred_theme
)
SELECT
  auth_user.id,
  lower(auth_user.email),
  COALESCE(NULLIF(auth_user.raw_user_meta_data->>'full_name', ''), split_part(auth_user.email, '@', 1)),
  NULLIF(auth_user.raw_user_meta_data->>'avatar_url', ''),
  NULLIF(regexp_replace(COALESCE(auth_user.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), ''),
  CASE WHEN auth_user.raw_user_meta_data->>'role' = 'seller'
    THEN 'seller'::public.user_role ELSE 'buyer'::public.user_role END,
  NULLIF(auth_user.raw_user_meta_data->>'business_name', ''),
  NULLIF(upper(auth_user.raw_user_meta_data->>'gstin'), ''),
  NULLIF(auth_user.raw_user_meta_data->>'address_line1', ''),
  NULLIF(auth_user.raw_user_meta_data->>'address_line2', ''),
  NULLIF(auth_user.raw_user_meta_data->>'city', ''),
  NULLIF(auth_user.raw_user_meta_data->>'state', ''),
  NULLIF(auth_user.raw_user_meta_data->>'pincode', ''),
  CASE WHEN auth_user.raw_user_meta_data->>'preferred_language' IN ('en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te')
    THEN auth_user.raw_user_meta_data->>'preferred_language' ELSE 'en' END,
  CASE WHEN auth_user.raw_user_meta_data->>'preferred_theme' IN ('light', 'dark', 'system')
    THEN auth_user.raw_user_meta_data->>'preferred_theme' ELSE 'system' END
FROM auth.users AS auth_user
WHERE auth_user.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_profiles profile WHERE profile.id = auth_user.id);

INSERT INTO public.seller_profiles (
  user_id, seller_ref, legal_business_name, display_name, business_type,
  gstin, gstin_verified, pan, verification_status, settlement_eligible,
  pickup_address, is_active
)
SELECT
  profile.id,
  'FT-SLR-' || upper(substr(replace(profile.id::text, '-', ''), 1, 12)),
  COALESCE(NULLIF(profile.business_name, ''), NULLIF(profile.full_name, ''), split_part(profile.email, '@', 1)),
  COALESCE(NULLIF(profile.business_name, ''), NULLIF(profile.full_name, ''), split_part(profile.email, '@', 1)),
  NULLIF(auth_user.raw_user_meta_data->>'business_type', ''),
  NULLIF(upper(COALESCE(profile.gstin, auth_user.raw_user_meta_data->>'gstin')), ''),
  false,
  NULLIF(upper(auth_user.raw_user_meta_data->>'pan'), ''),
  'registration_started'::public.seller_status,
  false,
  jsonb_strip_nulls(jsonb_build_object(
    'line1', profile.address_line1,
    'line2', profile.address_line2,
    'city', profile.city,
    'state', profile.state,
    'pincode', profile.pincode,
    'country', 'India'
  )),
  COALESCE(profile.is_active, true)
FROM public.user_profiles profile
JOIN auth.users auth_user ON auth_user.id = profile.id
WHERE profile.role = 'seller'::public.user_role
  AND NOT EXISTS (SELECT 1 FROM public.seller_profiles seller WHERE seller.user_id = profile.id);

INSERT INTO public.buyer_profiles (
  user_id, buyer_ref, business_name, business_type, gstin,
  gstin_verified, billing_address, is_active
)
SELECT
  profile.id,
  'FT-BYR-' || upper(substr(replace(profile.id::text, '-', ''), 1, 12)),
  NULLIF(profile.business_name, ''),
  NULLIF(auth_user.raw_user_meta_data->>'business_type', ''),
  NULLIF(upper(COALESCE(profile.gstin, auth_user.raw_user_meta_data->>'gstin')), ''),
  false,
  jsonb_strip_nulls(jsonb_build_object(
    'line1', profile.address_line1,
    'line2', profile.address_line2,
    'city', profile.city,
    'state', profile.state,
    'pincode', profile.pincode,
    'country', 'India'
  )),
  COALESCE(profile.is_active, true)
FROM public.user_profiles profile
JOIN auth.users auth_user ON auth_user.id = profile.id
WHERE profile.role = 'buyer'::public.user_role
  AND NOT EXISTS (SELECT 1 FROM public.buyer_profiles buyer WHERE buyer.user_id = profile.id);

-- Prevent future duplicate role profiles where historical data is already clean.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT user_id FROM public.seller_profiles GROUP BY user_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_profiles_user_id_unique
      ON public.seller_profiles(user_id);
  END IF;
  IF NOT EXISTS (
    SELECT user_id FROM public.buyer_profiles GROUP BY user_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_profiles_user_id_unique
      ON public.buyer_profiles(user_id);
  END IF;
END $$;

-- Private document storage for seller onboarding.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-registration-documents',
  'seller-registration-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS seller_registration_document_owner_upload ON storage.objects;
CREATE POLICY seller_registration_document_owner_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seller-registration-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS seller_registration_document_owner_read ON storage.objects;
CREATE POLICY seller_registration_document_owner_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'seller-registration-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS seller_registration_document_owner_update ON storage.objects;
CREATE POLICY seller_registration_document_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'seller-registration-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'seller-registration-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS seller_registration_document_owner_delete ON storage.objects;
CREATE POLICY seller_registration_document_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'seller-registration-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );
