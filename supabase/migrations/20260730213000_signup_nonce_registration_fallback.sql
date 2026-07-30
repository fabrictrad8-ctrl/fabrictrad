-- Secure fallback for email-confirmation signups when the Worker does not have a
-- service-role key. A high-entropy nonce is stored in auth user metadata during
-- signup, is valid only for two hours, and is cleared after seller submission.

CREATE OR REPLACE FUNCTION public.is_valid_registration_nonce(
  p_user_id uuid,
  p_nonce text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = p_user_id
      AND auth_user.created_at >= now() - interval '2 hours'
      AND length(COALESCE(p_nonce, '')) >= 20
      AND auth_user.raw_user_meta_data->>'registration_nonce' = p_nonce
  )
$$;

REVOKE ALL ON FUNCTION public.is_valid_registration_nonce(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_registration_nonce(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_valid_seller_registration_upload_path(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  path_parts text[];
  target_user_id uuid;
  target_nonce text;
BEGIN
  path_parts := storage.foldername(p_name);
  IF array_length(path_parts, 1) < 2 THEN
    RETURN false;
  END IF;

  BEGIN
    target_user_id := path_parts[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  target_nonce := path_parts[2];

  RETURN public.is_valid_registration_nonce(target_user_id, target_nonce)
    AND EXISTS (
      SELECT 1 FROM auth.users AS auth_user
      WHERE auth_user.id = target_user_id
        AND auth_user.raw_user_meta_data->>'role' = 'seller'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_seller_registration_upload_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_seller_registration_upload_path(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_signup_account_by_nonce(
  p_user_id uuid,
  p_nonce text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  auth_user auth.users%ROWTYPE;
  requested_role public.user_role;
  normalized_phone text;
  seller_profile_id uuid;
  buyer_profile_id uuid;
  profile_address jsonb;
  reference_suffix text;
BEGIN
  IF NOT public.is_valid_registration_nonce(p_user_id, p_nonce) THEN
    RAISE EXCEPTION 'Registration verification expired or invalid' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO auth_user FROM auth.users WHERE id = p_user_id;
  requested_role := CASE
    WHEN auth_user.raw_user_meta_data->>'role' = 'seller' THEN 'seller'::public.user_role
    ELSE 'buyer'::public.user_role
  END;
  normalized_phone := NULLIF(
    regexp_replace(COALESCE(auth_user.raw_user_meta_data->>'phone', ''), '\D', '', 'g'),
    ''
  );
  profile_address := jsonb_strip_nulls(jsonb_build_object(
    'line1', NULLIF(auth_user.raw_user_meta_data->>'address_line1', ''),
    'line2', NULLIF(auth_user.raw_user_meta_data->>'address_line2', ''),
    'city', NULLIF(auth_user.raw_user_meta_data->>'city', ''),
    'state', NULLIF(auth_user.raw_user_meta_data->>'state', ''),
    'pincode', NULLIF(auth_user.raw_user_meta_data->>'pincode', ''),
    'country', 'India'
  ));
  reference_suffix := upper(substr(replace(p_user_id::text, '-', ''), 1, 12));

  INSERT INTO public.user_profiles (
    id, email, full_name, avatar_url, phone, role, business_name, gstin,
    address_line1, address_line2, city, state, pincode,
    preferred_language, preferred_theme, is_active
  ) VALUES (
    p_user_id,
    lower(auth_user.email),
    COALESCE(NULLIF(auth_user.raw_user_meta_data->>'full_name', ''), split_part(auth_user.email, '@', 1)),
    NULLIF(auth_user.raw_user_meta_data->>'avatar_url', ''),
    normalized_phone,
    requested_role,
    NULLIF(auth_user.raw_user_meta_data->>'business_name', ''),
    NULLIF(upper(auth_user.raw_user_meta_data->>'gstin'), ''),
    NULLIF(auth_user.raw_user_meta_data->>'address_line1', ''),
    NULLIF(auth_user.raw_user_meta_data->>'address_line2', ''),
    NULLIF(auth_user.raw_user_meta_data->>'city', ''),
    NULLIF(auth_user.raw_user_meta_data->>'state', ''),
    NULLIF(auth_user.raw_user_meta_data->>'pincode', ''),
    CASE WHEN auth_user.raw_user_meta_data->>'preferred_language' IN ('en','hi','bn','gu','kn','ml','mr','pa','ta','te')
      THEN auth_user.raw_user_meta_data->>'preferred_language' ELSE 'en' END,
    CASE WHEN auth_user.raw_user_meta_data->>'preferred_theme' IN ('light','dark','system')
      THEN auth_user.raw_user_meta_data->>'preferred_theme' ELSE 'system' END,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    business_name = COALESCE(EXCLUDED.business_name, public.user_profiles.business_name),
    gstin = COALESCE(EXCLUDED.gstin, public.user_profiles.gstin),
    address_line1 = COALESCE(EXCLUDED.address_line1, public.user_profiles.address_line1),
    address_line2 = COALESCE(EXCLUDED.address_line2, public.user_profiles.address_line2),
    city = COALESCE(EXCLUDED.city, public.user_profiles.city),
    state = COALESCE(EXCLUDED.state, public.user_profiles.state),
    pincode = COALESCE(EXCLUDED.pincode, public.user_profiles.pincode),
    updated_at = now();

  IF requested_role = 'seller'::public.user_role THEN
    SELECT id INTO seller_profile_id
    FROM public.seller_profiles WHERE user_id = p_user_id LIMIT 1;

    IF seller_profile_id IS NULL THEN
      INSERT INTO public.seller_profiles (
        user_id, seller_ref, legal_business_name, display_name, business_type,
        gstin, gstin_verified, pan, verification_status, settlement_eligible,
        pickup_address, is_active
      ) VALUES (
        p_user_id,
        'FT-SLR-' || reference_suffix,
        COALESCE(NULLIF(auth_user.raw_user_meta_data->>'business_name', ''), NULLIF(auth_user.raw_user_meta_data->>'full_name', ''), split_part(auth_user.email, '@', 1)),
        COALESCE(NULLIF(auth_user.raw_user_meta_data->>'business_name', ''), NULLIF(auth_user.raw_user_meta_data->>'full_name', ''), split_part(auth_user.email, '@', 1)),
        NULLIF(auth_user.raw_user_meta_data->>'business_type', ''),
        NULLIF(upper(auth_user.raw_user_meta_data->>'gstin'), ''),
        false,
        NULLIF(upper(auth_user.raw_user_meta_data->>'pan'), ''),
        'registration_started'::public.seller_status,
        false,
        profile_address,
        true
      ) RETURNING id INTO seller_profile_id;
    END IF;
  ELSE
    SELECT id INTO buyer_profile_id
    FROM public.buyer_profiles WHERE user_id = p_user_id LIMIT 1;

    IF buyer_profile_id IS NULL THEN
      INSERT INTO public.buyer_profiles (
        user_id, buyer_ref, business_name, business_type, gstin,
        gstin_verified, billing_address, is_active
      ) VALUES (
        p_user_id,
        'FT-BYR-' || reference_suffix,
        NULLIF(auth_user.raw_user_meta_data->>'business_name', ''),
        NULLIF(auth_user.raw_user_meta_data->>'business_type', ''),
        NULLIF(upper(auth_user.raw_user_meta_data->>'gstin'), ''),
        false,
        profile_address,
        true
      ) RETURNING id INTO buyer_profile_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ready', true,
    'role', requested_role::text,
    'userProfileId', p_user_id,
    'buyerProfileId', buyer_profile_id,
    'sellerProfileId', seller_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_signup_account_by_nonce(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signup_account_by_nonce(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_seller_registration_with_nonce(
  p_user_id uuid,
  p_nonce text,
  p_payload jsonb,
  p_documents jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  auth_user auth.users%ROWTYPE;
  seller_profile_id uuid;
  registration_id uuid;
  seller_reference text;
  submitted_time timestamptz := now();
  phone_value text;
  account_digits text;
  masked_account text;
  document_item jsonb;
  document_count integer := 0;
  existing_bank_id uuid;
BEGIN
  IF NOT public.is_valid_registration_nonce(p_user_id, p_nonce) THEN
    RAISE EXCEPTION 'Registration verification expired or invalid' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO auth_user FROM auth.users WHERE id = p_user_id;
  IF auth_user.raw_user_meta_data->>'role' <> 'seller' THEN
    RAISE EXCEPTION 'This account is not registered as a seller' USING ERRCODE = '42501';
  END IF;

  PERFORM public.get_signup_account_by_nonce(p_user_id, p_nonce);
  SELECT id, seller_ref INTO seller_profile_id, seller_reference
  FROM public.seller_profiles WHERE user_id = p_user_id LIMIT 1;

  phone_value := regexp_replace(
    COALESCE(NULLIF(p_payload->>'phone', ''), auth_user.raw_user_meta_data->>'phone', ''),
    '\D', '', 'g'
  );
  IF length(phone_value) <> 10 OR phone_value !~ '^[6-9]' THEN
    RAISE EXCEPTION 'A valid 10 digit Indian phone number is required';
  END IF;

  account_digits := regexp_replace(COALESCE(p_payload->>'bankAccountNumber', ''), '\D', '', 'g');
  masked_account := CASE WHEN account_digits = '' THEN NULL ELSE '****' || right(account_digits, 4) END;

  INSERT INTO public.seller_registrations (
    user_id, seller_id, phone, owner_name, email, business_name, business_type,
    city, state, pincode, address, categories, monthly_capacity, gstin, pan,
    bank_account_number, bank_ifsc, bank_account_name, bank_name,
    registration_status, submitted_at, updated_at
  ) VALUES (
    p_user_id,
    seller_reference,
    phone_value,
    NULLIF(left(p_payload->>'ownerName', 160), ''),
    lower(auth_user.email),
    NULLIF(left(p_payload->>'businessName', 200), ''),
    NULLIF(left(p_payload->>'businessType', 100), ''),
    NULLIF(left(p_payload->>'city', 120), ''),
    NULLIF(left(p_payload->>'state', 120), ''),
    NULLIF(left(p_payload->>'pincode', 6), ''),
    NULLIF(left(p_payload->>'address', 1000), ''),
    ARRAY(SELECT left(value, 100) FROM jsonb_array_elements_text(COALESCE(p_payload->'categories', '[]'::jsonb)) AS value LIMIT 30),
    NULLIF(left(p_payload->>'monthlyCapacity', 100), ''),
    NULLIF(upper(left(p_payload->>'gstin', 15)), ''),
    NULLIF(upper(left(p_payload->>'pan', 10)), ''),
    masked_account,
    NULLIF(upper(left(p_payload->>'bankIfsc', 11)), ''),
    NULLIF(left(p_payload->>'bankAccountName', 200), ''),
    NULLIF(left(p_payload->>'bankName', 200), ''),
    CASE WHEN jsonb_array_length(COALESCE(p_documents, '[]'::jsonb)) > 0 THEN 'documents_uploaded' ELSE 'pending' END,
    submitted_time,
    submitted_time
  )
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
    registration_status = EXCLUDED.registration_status,
    submitted_at = EXCLUDED.submitted_at,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO registration_id;

  FOR document_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_documents, '[]'::jsonb))
  LOOP
    IF document_item->>'documentType' NOT IN ('gst_certificate','pan_card','cancelled_cheque','business_proof','address_proof') THEN
      RAISE EXCEPTION 'Unsupported registration document type';
    END IF;
    IF document_item->>'storagePath' NOT LIKE p_user_id::text || '/' || p_nonce || '/%' THEN
      RAISE EXCEPTION 'Invalid registration document path';
    END IF;

    INSERT INTO public.seller_registration_documents (
      registration_id, document_type, file_url, file_name, upload_status, updated_at
    ) VALUES (
      registration_id,
      document_item->>'documentType',
      document_item->>'storagePath',
      left(COALESCE(document_item->>'fileName', 'document'), 255),
      'uploaded',
      submitted_time
    )
    ON CONFLICT (registration_id, document_type) DO UPDATE SET
      file_url = EXCLUDED.file_url,
      file_name = EXCLUDED.file_name,
      upload_status = 'uploaded',
      rejection_reason = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = submitted_time;
    document_count := document_count + 1;
  END LOOP;

  SELECT id INTO existing_bank_id
  FROM public.seller_bank_profiles WHERE seller_id = seller_profile_id LIMIT 1;
  IF NULLIF(left(p_payload->>'bankAccountName', 200), '') IS NOT NULL THEN
    IF existing_bank_id IS NULL THEN
      INSERT INTO public.seller_bank_profiles (
        seller_id, account_holder_name, bank_name, account_number_masked,
        ifsc_code, account_type, is_verified, updated_at
      ) VALUES (
        seller_profile_id,
        left(p_payload->>'bankAccountName', 200),
        COALESCE(NULLIF(left(p_payload->>'bankName', 200), ''), 'Pending verification'),
        masked_account,
        NULLIF(upper(left(p_payload->>'bankIfsc', 11)), ''),
        'current',
        false,
        submitted_time
      );
    ELSE
      UPDATE public.seller_bank_profiles SET
        account_holder_name = left(p_payload->>'bankAccountName', 200),
        bank_name = COALESCE(NULLIF(left(p_payload->>'bankName', 200), ''), 'Pending verification'),
        account_number_masked = masked_account,
        ifsc_code = NULLIF(upper(left(p_payload->>'bankIfsc', 11)), ''),
        account_type = 'current',
        is_verified = false,
        updated_at = submitted_time
      WHERE id = existing_bank_id;
    END IF;
  END IF;

  UPDATE public.seller_profiles SET
    legal_business_name = COALESCE(NULLIF(left(p_payload->>'businessName', 200), ''), legal_business_name),
    display_name = COALESCE(NULLIF(left(p_payload->>'businessName', 200), ''), display_name),
    business_type = COALESCE(NULLIF(left(p_payload->>'businessType', 100), ''), business_type),
    gstin = COALESCE(NULLIF(upper(left(p_payload->>'gstin', 15)), ''), gstin),
    pan = COALESCE(NULLIF(upper(left(p_payload->>'pan', 10)), ''), pan),
    verification_status = CASE WHEN document_count > 0
      THEN 'documents_submitted'::public.seller_status
      ELSE 'profile_incomplete'::public.seller_status END,
    pickup_address = jsonb_strip_nulls(jsonb_build_object(
      'line1', NULLIF(left(p_payload->>'address', 1000), ''),
      'city', NULLIF(left(p_payload->>'city', 120), ''),
      'state', NULLIF(left(p_payload->>'state', 120), ''),
      'pincode', NULLIF(left(p_payload->>'pincode', 6), ''),
      'country', 'India'
    )),
    updated_at = submitted_time
  WHERE id = seller_profile_id;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'registration_nonce',
      updated_at = submitted_time
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'submitted', true,
    'sellerProfileId', seller_profile_id,
    'registrationId', registration_id,
    'sellerRef', seller_reference,
    'uploadedDocuments', document_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_seller_registration_with_nonce(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_seller_registration_with_nonce(uuid, text, jsonb, jsonb) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS seller_signup_nonce_document_upload ON storage.objects;
CREATE POLICY seller_signup_nonce_document_upload
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'seller-registration-documents'
    AND public.is_valid_seller_registration_upload_path(name)
  );
