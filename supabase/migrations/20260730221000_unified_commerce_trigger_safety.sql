-- Ensure unified account provisioning can pass the existing verification guards
-- only inside trusted security-definer transactions.

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
  v_business_name TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF normalized_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RAISE EXCEPTION 'Enter a valid GSTIN before activating seller access';
  END IF;

  SELECT regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
  INTO normalized_phone
  FROM public.user_profiles
  WHERE id = current_user_id;

  IF normalized_phone IS NULL OR length(normalized_phone) < 10 THEN
    RAISE EXCEPTION 'A verified account mobile number is required';
  END IF;

  v_business_name := COALESCE(
    NULLIF(trim(p_payload->>'businessName'), ''),
    NULLIF(trim(p_payload->>'ownerName'), ''),
    'FabricTrad Seller'
  );
  seller_reference := 'FT-SLR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12));

  -- Existing verification triggers trust service-role transactions. This setting
  -- is transaction-local and cannot be supplied by the browser.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('fabrictrad.trusted_capability_change', '1', true);

  UPDATE public.user_profiles
  SET can_buy = TRUE,
      can_sell = TRUE,
      account_kind = 'business',
      verification_method = 'gstin',
      verification_status = 'pending',
      identity_reference_last4 = right(normalized_gstin, 4),
      business_name = v_business_name,
      gstin = normalized_gstin,
      address_line1 = COALESCE(NULLIF(trim(p_payload->>'address'), ''), address_line1),
      city = COALESCE(NULLIF(trim(p_payload->>'city'), ''), city),
      state = COALESCE(NULLIF(trim(p_payload->>'state'), ''), state),
      pincode = COALESCE(NULLIF(trim(p_payload->>'pincode'), ''), pincode),
      updated_at = NOW()
  WHERE id = current_user_id;

  INSERT INTO public.buyer_profiles (
    user_id, buyer_ref, business_name, business_type, gstin, billing_address, is_active
  ) VALUES (
    current_user_id,
    'FT-BYR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12)),
    v_business_name,
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
    v_business_name,
    v_business_name,
    NULLIF(trim(p_payload->>'businessType'), ''),
    normalized_gstin,
    upper(NULLIF(trim(p_payload->>'pan'), '')),
    'registration_started'::public.seller_status,
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
    v_business_name,
    NULLIF(trim(p_payload->>'businessType'), ''),
    NULLIF(trim(p_payload->>'city'), ''),
    NULLIF(trim(p_payload->>'state'), ''),
    NULLIF(trim(p_payload->>'pincode'), ''),
    NULLIF(trim(p_payload->>'address'), ''),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'categories', '[]'::jsonb))),
      '{}'::TEXT[]
    ),
    NULLIF(trim(p_payload->>'monthlyCapacity'), ''),
    normalized_gstin,
    upper(NULLIF(trim(p_payload->>'pan'), '')),
    NULLIF(trim(p_payload->>'bankAccountNumberMasked'), ''),
    upper(NULLIF(trim(p_payload->>'bankIfsc'), '')),
    NULLIF(trim(p_payload->>'bankAccountName'), ''),
    NULLIF(trim(p_payload->>'bankName'), ''),
    'pending',
    NOW(),
    NOW()
  FROM public.user_profiles profile
  WHERE profile.id = current_user_id
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
    registration_status = 'pending',
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

CREATE OR REPLACE FUNCTION public.mark_seller_application_documents_uploaded()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  seller_record_id UUID;
  registration_record_id UUID;
  document_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT seller.id, registration.id
  INTO seller_record_id, registration_record_id
  FROM public.seller_profiles seller
  JOIN public.seller_registrations registration ON registration.user_id = seller.user_id
  WHERE seller.user_id = current_user_id
  LIMIT 1;

  IF seller_record_id IS NULL OR registration_record_id IS NULL THEN
    RAISE EXCEPTION 'Seller application not found';
  END IF;

  SELECT count(*)::INTEGER
  INTO document_count
  FROM public.seller_registration_documents
  WHERE registration_id = registration_record_id
    AND upload_status IN ('uploaded', 'under_review', 'approved');

  IF document_count < 3 THEN
    RAISE EXCEPTION 'Upload the required GST, PAN and bank documents first';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.seller_registrations
  SET registration_status = 'documents_uploaded', updated_at = NOW()
  WHERE id = registration_record_id;

  UPDATE public.seller_profiles
  SET verification_status = 'documents_submitted'::public.seller_status, updated_at = NOW()
  WHERE id = seller_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_seller_application_documents_uploaded() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_seller_application_documents_uploaded() TO authenticated;

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

  requested_seller := NEW.raw_user_meta_data->>'role' = 'seller'
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
    CASE
      WHEN requested_seller THEN NULLIF(NEW.raw_user_meta_data->>'business_type', '')
      ELSE 'Individual buyer'
    END,
    upper(NULLIF(NEW.raw_user_meta_data->>'gstin', '')),
    profile_address,
    TRUE
  )
  ON CONFLICT (user_id) DO NOTHING;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
