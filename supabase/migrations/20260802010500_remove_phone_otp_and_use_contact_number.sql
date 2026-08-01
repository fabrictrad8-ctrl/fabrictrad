-- Store mobile numbers as contact information without requiring an external SMS provider.

create or replace function public.set_current_account_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
begin
  if v_uid is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_phone := right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.user_profiles up
    where up.phone = v_phone
      and up.id <> v_uid
  ) then
    raise exception 'This mobile number belongs to another FabricTrad account.' using errcode = '23505';
  end if;

  update public.user_profiles
  set phone = v_phone,
      phone_verified = false,
      updated_at = now()
  where id = v_uid;

  if not found then
    raise exception 'Your FabricTrad account profile is not ready.' using errcode = 'P0002';
  end if;

  update public.seller_registrations
  set phone = v_phone,
      updated_at = now()
  where user_id = v_uid;

  update public.seller_profiles
  set verification_status = 'profile_incomplete'::public.seller_status,
      updated_at = now()
  where user_id = v_uid
    and verification_status = 'phone_unverified'::public.seller_status;

  return jsonb_build_object(
    'saved', true,
    'phone', v_phone,
    'verificationRequired', false
  );
end;
$$;

revoke all on function public.set_current_account_phone(text) from public, anon;
grant execute on function public.set_current_account_phone(text) to authenticated;

-- Phone authentication is not used by FabricTrad. Remove the old auth-phone synchronisation hook.
drop trigger if exists sync_confirmed_auth_phone_to_profile on auth.users;
drop function if exists public.sync_confirmed_auth_phone_to_profile();

update public.seller_profiles sp
set verification_status = 'profile_incomplete'::public.seller_status,
    updated_at = now()
from public.user_profiles up
where up.id = sp.user_id
  and nullif(btrim(coalesce(up.phone, '')), '') is not null
  and sp.verification_status = 'phone_unverified'::public.seller_status;

create or replace function public.ensure_current_seller_verification_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  select * into v_user
  from public.user_profiles
  where id = v_uid;

  if not found then
    raise exception 'Your FabricTrad account profile is not ready.' using errcode = 'P0002';
  end if;

  select * into v_seller
  from public.seller_profiles
  where user_id = v_uid;

  if not found or not coalesce(v_user.can_sell, v_user.role = 'seller') then
    raise exception 'Seller access is not active on this account.' using errcode = '42501';
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
      'pending',
      now(),
      now()
    ) returning * into v_registration;
  end if;

  select
    coalesce(array_agg(distinct d.document_type) filter (
      where d.document_type = any(v_required_document_types)
        and d.upload_status in ('uploaded', 'approved')
    ), array[]::text[]),
    count(distinct d.document_type) filter (
      where d.document_type = any(v_required_document_types)
        and d.upload_status in ('uploaded', 'approved')
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
$$;

revoke all on function public.ensure_current_seller_verification_state() from public, anon;
grant execute on function public.ensure_current_seller_verification_state() to authenticated;

create or replace function public.enforce_seller_verification_before_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone_present boolean := false;
  v_required_documents_approved integer := 0;
  v_bank_verified boolean := false;
  v_registration_id uuid;
begin
  if new.verification_status = 'verified'::public.seller_status
     and old.verification_status is distinct from new.verification_status then
    select nullif(btrim(coalesce(up.phone, '')), '') is not null
      into v_phone_present
    from public.user_profiles up
    where up.id = new.user_id;

    select sr.id into v_registration_id
    from public.seller_registrations sr
    where sr.user_id = new.user_id
    order by sr.updated_at desc
    limit 1;

    if v_registration_id is not null then
      select count(distinct d.document_type) into v_required_documents_approved
      from public.seller_registration_documents d
      where d.registration_id = v_registration_id
        and d.document_type in ('gst_certificate', 'pan_card', 'cancelled_cheque')
        and d.upload_status = 'approved';
    end if;

    select coalesce(bool_or(bp.is_verified), false) into v_bank_verified
    from public.seller_bank_profiles bp
    where bp.seller_id = new.id;

    if not v_phone_present then
      raise exception 'Seller mobile number must be added before approval.' using errcode = '23514';
    end if;
    if not coalesce(new.gstin_verified, false) or coalesce(new.gstin_status, '') <> 'active' then
      raise exception 'An active GSTIN must be confirmed before seller approval.' using errcode = '23514';
    end if;
    if v_required_documents_approved < 3 then
      raise exception 'GST certificate, PAN card and cancelled cheque must be approved before seller approval.' using errcode = '23514';
    end if;
    if not v_bank_verified then
      raise exception 'The settlement bank account must be verified before seller approval.' using errcode = '23514';
    end if;

    new.settlement_eligible := true;
    new.is_active := true;

    update public.seller_registrations
    set registration_status = 'approved',
        gstin_verified = true,
        bank_verified = true,
        approved_at = coalesce(approved_at, now()),
        updated_at = now()
    where id = v_registration_id;
  elsif new.verification_status <> 'verified'::public.seller_status then
    new.settlement_eligible := false;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_seller_verification_before_approval() from public, anon, authenticated;
