create or replace function public.request_seller_access(p_payload jsonb)
returns table(seller_profile_id uuid, registration_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_gstin text := upper(trim(coalesce(p_payload->>'gstin', '')));
  normalized_phone text;
  seller_record_id uuid;
  registration_record_id uuid;
  seller_reference text;
  v_business_name text;
  v_existing_status public.seller_status;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Enter a valid GSTIN before submitting seller registration';
  end if;

  select regexp_replace(coalesce(phone, ''), '\D', '', 'g')
    into normalized_phone
  from public.user_profiles
  where id = current_user_id;

  if normalized_phone is null or length(normalized_phone) < 10 then
    raise exception 'A valid account mobile number is required';
  end if;

  select verification_status
    into v_existing_status
  from public.seller_profiles
  where user_id = current_user_id;

  if v_existing_status = 'verified'::public.seller_status then
    raise exception 'Seller access is already active on this account';
  end if;

  if v_existing_status in (
    'rejected'::public.seller_status,
    'suspended'::public.seller_status,
    'permanently_blocked'::public.seller_status
  ) then
    raise exception 'This seller application cannot be reopened automatically. Contact FabricTrad support.' using errcode = '42501';
  end if;

  v_business_name := coalesce(
    nullif(trim(p_payload->>'businessName'), ''),
    nullif(trim(p_payload->>'ownerName'), ''),
    'FabricTrad Seller'
  );
  seller_reference := 'FT-SLR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12));

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('fabrictrad.trusted_capability_change', '1', true);

  update public.user_profiles
     set role = 'buyer'::public.user_role,
         can_buy = true,
         can_sell = false,
         account_kind = 'business',
         verification_method = 'gstin',
         verification_status = 'pending',
         identity_reference_last4 = right(normalized_gstin, 4),
         business_name = v_business_name,
         gstin = normalized_gstin,
         address_line1 = coalesce(nullif(trim(p_payload->>'address'), ''), address_line1),
         city = coalesce(nullif(trim(p_payload->>'city'), ''), city),
         state = coalesce(nullif(trim(p_payload->>'state'), ''), state),
         pincode = coalesce(nullif(trim(p_payload->>'pincode'), ''), pincode),
         updated_at = now()
   where id = current_user_id
     and role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

  if not found then
    raise exception 'Seller registration is unavailable for this account' using errcode = '42501';
  end if;

  insert into public.buyer_profiles (
    user_id, buyer_ref, business_name, business_type, gstin, billing_address, is_active
  ) values (
    current_user_id,
    'FT-BYR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12)),
    v_business_name,
    coalesce(nullif(trim(p_payload->>'businessType'), ''), 'Business buyer'),
    normalized_gstin,
    jsonb_strip_nulls(jsonb_build_object(
      'line1', nullif(trim(p_payload->>'address'), ''),
      'city', nullif(trim(p_payload->>'city'), ''),
      'state', nullif(trim(p_payload->>'state'), ''),
      'pincode', nullif(trim(p_payload->>'pincode'), ''),
      'country', 'India'
    )),
    true
  )
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    business_type = excluded.business_type,
    gstin = excluded.gstin,
    billing_address = excluded.billing_address,
    is_active = true,
    updated_at = now();

  insert into public.seller_profiles (
    user_id, seller_ref, legal_business_name, display_name, business_type, gstin, pan,
    verification_status, pickup_address, is_active
  ) values (
    current_user_id,
    seller_reference,
    v_business_name,
    v_business_name,
    nullif(trim(p_payload->>'businessType'), ''),
    normalized_gstin,
    upper(nullif(trim(p_payload->>'pan'), '')),
    'registration_started'::public.seller_status,
    jsonb_strip_nulls(jsonb_build_object(
      'line1', nullif(trim(p_payload->>'address'), ''),
      'city', nullif(trim(p_payload->>'city'), ''),
      'state', nullif(trim(p_payload->>'state'), ''),
      'pincode', nullif(trim(p_payload->>'pincode'), ''),
      'country', 'India'
    )),
    true
  )
  on conflict (user_id) do update set
    legal_business_name = excluded.legal_business_name,
    display_name = excluded.display_name,
    business_type = excluded.business_type,
    gstin = excluded.gstin,
    pan = coalesce(excluded.pan, public.seller_profiles.pan),
    pickup_address = excluded.pickup_address,
    verification_status = case
      when public.seller_profiles.verification_status in (
        'rejected'::public.seller_status,
        'suspended'::public.seller_status,
        'permanently_blocked'::public.seller_status,
        'verified'::public.seller_status
      ) then public.seller_profiles.verification_status
      else 'registration_started'::public.seller_status
    end,
    is_active = true,
    updated_at = now()
  returning id into seller_record_id;

  insert into public.seller_registrations (
    user_id, seller_id, phone, owner_name, email, business_name, business_type,
    city, state, pincode, address, categories, monthly_capacity, gstin, pan,
    bank_account_number, bank_ifsc, bank_account_name, bank_name,
    registration_status, submitted_at, updated_at
  )
  select
    current_user_id,
    seller_reference,
    right(normalized_phone, 10),
    nullif(trim(p_payload->>'ownerName'), ''),
    profile.email,
    v_business_name,
    nullif(trim(p_payload->>'businessType'), ''),
    nullif(trim(p_payload->>'city'), ''),
    nullif(trim(p_payload->>'state'), ''),
    nullif(trim(p_payload->>'pincode'), ''),
    nullif(trim(p_payload->>'address'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'categories', '[]'::jsonb))), '{}'::text[]),
    nullif(trim(p_payload->>'monthlyCapacity'), ''),
    normalized_gstin,
    upper(nullif(trim(p_payload->>'pan'), '')),
    nullif(trim(p_payload->>'bankAccountNumberMasked'), ''),
    upper(nullif(trim(p_payload->>'bankIfsc'), '')),
    nullif(trim(p_payload->>'bankAccountName'), ''),
    nullif(trim(p_payload->>'bankName'), ''),
    'pending',
    now(),
    now()
  from public.user_profiles profile
  where profile.id = current_user_id
  on conflict (user_id) do update set
    phone = excluded.phone,
    owner_name = excluded.owner_name,
    email = excluded.email,
    business_name = excluded.business_name,
    business_type = excluded.business_type,
    city = excluded.city,
    state = excluded.state,
    pincode = excluded.pincode,
    address = excluded.address,
    categories = excluded.categories,
    monthly_capacity = excluded.monthly_capacity,
    gstin = excluded.gstin,
    pan = excluded.pan,
    bank_account_number = coalesce(excluded.bank_account_number, public.seller_registrations.bank_account_number),
    bank_ifsc = coalesce(excluded.bank_ifsc, public.seller_registrations.bank_ifsc),
    bank_account_name = coalesce(excluded.bank_account_name, public.seller_registrations.bank_account_name),
    bank_name = coalesce(excluded.bank_name, public.seller_registrations.bank_name),
    registration_status = 'pending',
    submitted_at = now(),
    rejection_reason = null,
    updated_at = now()
  returning id into registration_record_id;

  insert into public.account_verifications (user_id, method, reference_last4, status)
  values (current_user_id, 'gstin', right(normalized_gstin, 4), 'pending')
  on conflict (user_id, method) do update set
    reference_last4 = excluded.reference_last4,
    status = 'pending',
    submitted_at = now(),
    reviewed_at = null,
    reviewed_by = null,
    review_notes = null,
    updated_at = now();

  return query select seller_record_id, registration_record_id;
end;
$function$;

create or replace function public.ensure_current_seller_verification_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_user public.user_profiles%rowtype;
  v_seller public.seller_profiles%rowtype;
  v_registration public.seller_registrations%rowtype;
  v_bank public.seller_bank_profiles%rowtype;
  v_required_document_types text[] := array['gst_certificate', 'pan_card', 'cancelled_cheque'];
  v_uploaded_document_types text[] := array[]::text[];
  v_uploaded_documents integer := 0;
  v_approved_documents integer := 0;
  v_profile_complete boolean := false;
  v_phone_present boolean := false;
  v_bank_details_present boolean := false;
  v_bank_verified boolean := false;
  v_status public.seller_status;
  v_next_action text;
  v_preserve_status boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_user from public.user_profiles where id = v_uid;
  if not found or v_user.is_active is not true then
    raise exception 'Your FabricTrad account profile is not active.' using errcode = '42501';
  end if;
  if v_user.role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role) then
    raise exception 'Administrator accounts cannot enter seller onboarding.' using errcode = '42501';
  end if;

  select * into v_seller from public.seller_profiles where user_id = v_uid;
  if not found then
    raise exception 'Seller application not found.' using errcode = 'P0002';
  end if;

  select * into v_registration
  from public.seller_registrations
  where user_id = v_uid
  order by updated_at desc
  limit 1;

  if v_registration.id is null then
    insert into public.seller_registrations (
      user_id, seller_id, phone, owner_name, email, business_name, business_type,
      city, state, pincode, address, gstin, pan, gstin_verified, bank_verified,
      registration_status, created_at, updated_at
    ) values (
      v_uid,
      coalesce(nullif(v_seller.seller_ref, ''), 'FT-SLR-' || upper(left(replace(v_uid::text, '-', ''), 12))),
      v_user.phone,
      v_user.full_name,
      v_user.email,
      coalesce(nullif(v_seller.legal_business_name, ''), nullif(v_user.business_name, ''), v_user.full_name),
      v_seller.business_type,
      coalesce(v_seller.pickup_address ->> 'city', v_user.city),
      coalesce(v_seller.pickup_address ->> 'state', v_user.state),
      coalesce(v_seller.pickup_address ->> 'pincode', v_user.pincode),
      coalesce(v_seller.pickup_address ->> 'line1', v_user.address_line1),
      v_seller.gstin,
      v_seller.pan,
      coalesce(v_seller.gstin_verified, false),
      false,
      'pending', now(), now()
    ) returning * into v_registration;
  end if;

  select
    coalesce(array_agg(distinct d.document_type) filter (
      where d.document_type = any(v_required_document_types)
        and d.upload_status in ('uploaded', 'under_review', 'approved')
    ), array[]::text[]),
    count(distinct d.document_type) filter (
      where d.document_type = any(v_required_document_types)
        and d.upload_status in ('uploaded', 'under_review', 'approved')
    ),
    count(distinct d.document_type) filter (
      where d.document_type = any(v_required_document_types)
        and d.upload_status = 'approved'
    )
  into v_uploaded_document_types, v_uploaded_documents, v_approved_documents
  from public.seller_registration_documents d
  where d.registration_id = v_registration.id;

  select * into v_bank
  from public.seller_bank_profiles
  where seller_id = v_seller.id
  order by updated_at desc
  limit 1;

  v_phone_present := nullif(btrim(coalesce(v_user.phone, '')), '') is not null;
  v_bank_details_present := v_bank.id is not null
    and nullif(v_bank.account_number_masked, '') is not null
    and nullif(v_bank.ifsc_code, '') is not null;
  v_bank_verified := coalesce(v_bank.is_verified, false);

  v_profile_complete :=
    nullif(btrim(coalesce(v_user.business_name, v_seller.legal_business_name, '')), '') is not null
    and v_phone_present
    and nullif(btrim(coalesce(v_seller.gstin, v_user.gstin, '')), '') is not null
    and nullif(btrim(coalesce(v_user.city, v_seller.pickup_address ->> 'city', '')), '') is not null
    and nullif(btrim(coalesce(v_user.address_line1, v_seller.pickup_address ->> 'line1', '')), '') is not null
    and nullif(btrim(coalesce(v_user.pincode, v_seller.pickup_address ->> 'pincode', '')), '') is not null;

  v_preserve_status := v_seller.verification_status in (
    'rejected'::public.seller_status,
    'suspended'::public.seller_status,
    'permanently_blocked'::public.seller_status
  );

  if not v_phone_present then
    v_status := 'profile_incomplete'::public.seller_status;
    v_next_action := 'add_phone';
  elsif not v_profile_complete then
    v_status := 'profile_incomplete'::public.seller_status;
    v_next_action := 'complete_profile';
  elsif v_uploaded_documents < cardinality(v_required_document_types) or not v_bank_details_present then
    v_status := 'profile_incomplete'::public.seller_status;
    v_next_action := 'complete_application';
  elsif not coalesce(v_seller.gstin_verified, false) then
    v_status := 'manual_review'::public.seller_status;
    v_next_action := 'gst_review';
  elsif v_approved_documents < cardinality(v_required_document_types) then
    v_status := 'manual_review'::public.seller_status;
    v_next_action := 'document_review';
  elsif not v_bank_verified then
    v_status := 'manual_review'::public.seller_status;
    v_next_action := 'bank_review';
  else
    v_status := 'verified'::public.seller_status;
    v_next_action := 'complete';
  end if;

  if not v_preserve_status then
    update public.seller_profiles
       set verification_status = v_status,
           settlement_eligible = (v_status = 'verified'::public.seller_status and v_bank_verified),
           updated_at = now()
     where id = v_seller.id;
  else
    v_status := v_seller.verification_status;
    v_next_action := 'contact_support';
  end if;

  update public.seller_registrations
     set phone = v_user.phone,
         business_name = coalesce(nullif(business_name, ''), v_user.business_name, v_seller.legal_business_name),
         city = coalesce(nullif(city, ''), v_user.city, v_seller.pickup_address ->> 'city'),
         state = coalesce(nullif(state, ''), v_user.state, v_seller.pickup_address ->> 'state'),
         pincode = coalesce(nullif(pincode, ''), v_user.pincode, v_seller.pickup_address ->> 'pincode'),
         address = coalesce(nullif(address, ''), v_user.address_line1, v_seller.pickup_address ->> 'line1'),
         gstin = coalesce(nullif(gstin, ''), v_seller.gstin),
         pan = coalesce(nullif(pan, ''), v_seller.pan),
         gstin_verified = coalesce(v_seller.gstin_verified, false),
         bank_verified = v_bank_verified,
         updated_at = now()
   where id = v_registration.id;

  return jsonb_build_object(
    'sellerProfileId', v_seller.id,
    'registrationId', v_registration.id,
    'profileComplete', v_profile_complete,
    'phonePresent', v_phone_present,
    'phoneVerificationRequired', false,
    'phone', v_user.phone,
    'gstinEntered', nullif(btrim(coalesce(v_seller.gstin, '')), '') is not null,
    'gstinVerified', coalesce(v_seller.gstin_verified, false),
    'gstinStatus', coalesce(v_seller.gstin_status, 'not_checked'),
    'requiredDocumentsTotal', cardinality(v_required_document_types),
    'requiredDocumentsUploaded', v_uploaded_documents,
    'requiredDocumentsApproved', v_approved_documents,
    'uploadedDocumentTypes', to_jsonb(v_uploaded_document_types),
    'bankDetailsPresent', v_bank_details_present,
    'bankVerified', v_bank_verified,
    'registrationStatus', v_registration.registration_status,
    'verificationStatus', v_status::text,
    'settlementEligible', (v_status = 'verified'::public.seller_status and v_bank_verified),
    'nextAction', v_next_action,
    'businessType', coalesce(v_registration.business_type, v_seller.business_type),
    'pan', coalesce(v_registration.pan, v_seller.pan),
    'categories', to_jsonb(coalesce(v_registration.categories, array[]::text[])),
    'monthlyCapacity', v_registration.monthly_capacity,
    'bankAccountName', v_bank.account_holder_name,
    'bankName', v_bank.bank_name,
    'bankIfsc', v_bank.ifsc_code,
    'bankAccountMasked', v_bank.account_number_masked
  );
end;
$function$;

create or replace function public.sync_verified_seller_account_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform set_config('fabrictrad.trusted_capability_change', '1', true);

  update public.user_profiles
     set role = 'buyer'::public.user_role,
         can_buy = true,
         can_sell = (new.verification_status = 'verified'::public.seller_status and new.is_active = true),
         verification_status = case
           when new.verification_status = 'verified'::public.seller_status and new.is_active = true then 'verified'
           when new.verification_status in ('rejected'::public.seller_status, 'suspended'::public.seller_status, 'permanently_blocked'::public.seller_status) then new.verification_status::text
           else 'pending'
         end,
         updated_at = now()
   where id = new.user_id
     and role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

  update public.buyer_profiles
     set is_active = true,
         updated_at = now()
   where user_id = new.user_id;

  return new;
end;
$function$;

drop trigger if exists sync_verified_seller_account_status_trigger on public.seller_profiles;
create trigger sync_verified_seller_account_status_trigger
after insert or update of verification_status, is_active on public.seller_profiles
for each row
execute function public.sync_verified_seller_account_status();

update public.user_profiles up
set role = 'buyer'::public.user_role,
    can_buy = true,
    can_sell = exists (
      select 1 from public.seller_profiles sp
      where sp.user_id = up.id
        and sp.verification_status = 'verified'::public.seller_status
        and sp.is_active = true
    ),
    updated_at = now()
where up.role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);
