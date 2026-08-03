-- Authentication metadata can retain a phone number that is already attached
-- to an older FabricTrad account. Profile hydration must not fail the entire
-- login in that case. Keep phone uniqueness, but defer attaching a conflicting
-- metadata phone until the account owner resolves it through the protected
-- contact-number flow.

create or replace function public.ensure_current_account_profile(p_requested_role text default 'buyer'::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_user_id uuid := auth.uid();
  auth_record auth.users%rowtype;
  profile_record public.user_profiles%rowtype;
  buyer_profile_id uuid;
  seller_profile_id uuid;
  metadata_role public.user_role := 'buyer'::public.user_role;
  normalized_requested_role text := lower(trim(coalesce(p_requested_role, 'buyer')));
  normalized_email text;
  metadata_full_name text;
  metadata_avatar text;
  metadata_phone text;
  safe_metadata_phone text;
  metadata_business_name text;
  metadata_gstin text;
  should_sell boolean := false;
  is_admin_account boolean := false;
  profile_address jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_requested_role not in ('buyer', 'seller') then
    normalized_requested_role := 'buyer';
  end if;

  select * into auth_record
  from auth.users
  where id = current_user_id;

  if not found then
    raise exception 'Authenticated account was not found' using errcode = 'P0002';
  end if;

  normalized_email := lower(trim(coalesce(auth_record.email, '')));
  if normalized_email = '' then
    raise exception 'The authenticated account does not have an email address';
  end if;

  metadata_full_name := coalesce(
    nullif(trim(auth_record.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(auth_record.raw_user_meta_data->>'name'), ''),
    split_part(normalized_email, '@', 1)
  );
  metadata_avatar := coalesce(
    nullif(trim(auth_record.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(auth_record.raw_user_meta_data->>'picture'), '')
  );
  metadata_phone := nullif(
    regexp_replace(coalesce(auth_record.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g'),
    ''
  );

  safe_metadata_phone := metadata_phone;
  if safe_metadata_phone is not null and exists (
    select 1
    from public.user_profiles other_profile
    where other_profile.id <> current_user_id
      and regexp_replace(coalesce(other_profile.phone, ''), '[^0-9]', '', 'g') = safe_metadata_phone
  ) then
    safe_metadata_phone := null;
  end if;

  metadata_business_name := nullif(trim(auth_record.raw_user_meta_data->>'business_name'), '');
  metadata_gstin := upper(nullif(trim(auth_record.raw_user_meta_data->>'gstin'), ''));

  if auth_record.raw_app_meta_data->>'role' in ('super_admin', 'admin_staff', 'seller', 'buyer') then
    metadata_role := (auth_record.raw_app_meta_data->>'role')::public.user_role;
  elsif auth_record.raw_user_meta_data->>'role' = 'seller' or metadata_gstin is not null then
    metadata_role := 'seller'::public.user_role;
  end if;

  select * into profile_record
  from public.user_profiles
  where id = current_user_id;

  if not found then
    should_sell := metadata_role = 'seller'::public.user_role;
    is_admin_account := metadata_role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

    insert into public.user_profiles (
      id, email, full_name, phone, role, is_active, avatar_url,
      business_name, gstin, account_kind, verification_method,
      verification_status, identity_reference_last4, can_buy, can_sell
    ) values (
      current_user_id,
      normalized_email,
      metadata_full_name,
      safe_metadata_phone,
      metadata_role,
      true,
      metadata_avatar,
      metadata_business_name,
      metadata_gstin,
      case when should_sell then 'business' else 'individual' end,
      case when metadata_gstin is not null then 'gstin' else 'none' end,
      case when metadata_gstin is not null then 'pending' else 'unverified' end,
      case when metadata_gstin is not null then right(metadata_gstin, 4) else null end,
      not is_admin_account,
      should_sell and not is_admin_account
    )
    returning * into profile_record;
  else
    update public.user_profiles
    set email = normalized_email,
        full_name = coalesce(nullif(public.user_profiles.full_name, ''), metadata_full_name),
        avatar_url = coalesce(public.user_profiles.avatar_url, metadata_avatar),
        phone = coalesce(public.user_profiles.phone, safe_metadata_phone),
        updated_at = now()
    where id = current_user_id
    returning * into profile_record;
  end if;

  is_admin_account := profile_record.role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);
  should_sell := not is_admin_account and coalesce(profile_record.can_sell, false);

  profile_address := jsonb_strip_nulls(jsonb_build_object(
    'line1', profile_record.address_line1,
    'line2', profile_record.address_line2,
    'city', profile_record.city,
    'state', profile_record.state,
    'pincode', profile_record.pincode,
    'country', 'India'
  ));

  if not is_admin_account then
    insert into public.buyer_profiles (
      user_id, buyer_ref, business_name, business_type, gstin,
      gstin_verified, billing_address, is_active
    ) values (
      current_user_id,
      'FT-BYR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12)),
      profile_record.business_name,
      case when profile_record.account_kind = 'business' then 'Business buyer' else 'Individual buyer' end,
      profile_record.gstin,
      profile_record.verification_method = 'gstin' and profile_record.verification_status = 'verified',
      profile_address,
      coalesce(profile_record.is_active, true)
    )
    on conflict (user_id) do update set
      business_name = coalesce(public.buyer_profiles.business_name, excluded.business_name),
      business_type = coalesce(public.buyer_profiles.business_type, excluded.business_type),
      gstin = coalesce(public.buyer_profiles.gstin, excluded.gstin),
      billing_address = case
        when public.buyer_profiles.billing_address is null or public.buyer_profiles.billing_address = '{}'::jsonb
          then excluded.billing_address
        else public.buyer_profiles.billing_address
      end,
      is_active = excluded.is_active,
      updated_at = now()
    returning id into buyer_profile_id;
  end if;

  if should_sell then
    insert into public.seller_profiles (
      user_id, seller_ref, legal_business_name, display_name, business_type,
      gstin, pan, verification_status, gstin_verified, settlement_eligible,
      pickup_address, is_active
    ) values (
      current_user_id,
      'FT-SLR-' || upper(substr(replace(current_user_id::text, '-', ''), 1, 12)),
      coalesce(nullif(profile_record.business_name, ''), nullif(profile_record.full_name, ''), split_part(normalized_email, '@', 1)),
      coalesce(nullif(profile_record.business_name, ''), nullif(profile_record.full_name, ''), split_part(normalized_email, '@', 1)),
      'Business seller',
      profile_record.gstin,
      upper(nullif(trim(auth_record.raw_user_meta_data->>'pan'), '')),
      'registration_started'::public.seller_status,
      profile_record.verification_method = 'gstin' and profile_record.verification_status = 'verified',
      false,
      profile_address,
      coalesce(profile_record.is_active, true)
    )
    on conflict (user_id) do update set
      legal_business_name = coalesce(nullif(public.seller_profiles.legal_business_name, ''), excluded.legal_business_name),
      display_name = coalesce(nullif(public.seller_profiles.display_name, ''), excluded.display_name),
      business_type = coalesce(public.seller_profiles.business_type, excluded.business_type),
      gstin = coalesce(public.seller_profiles.gstin, excluded.gstin),
      pickup_address = case
        when public.seller_profiles.pickup_address is null or public.seller_profiles.pickup_address = '{}'::jsonb
          then excluded.pickup_address
        else public.seller_profiles.pickup_address
      end,
      is_active = excluded.is_active,
      updated_at = now()
    returning id into seller_profile_id;
  else
    select id into seller_profile_id
    from public.seller_profiles
    where user_id = current_user_id
    limit 1;
  end if;

  return jsonb_build_object(
    'ready', true,
    'role', profile_record.role::text,
    'requestedRole', normalized_requested_role,
    'userProfileId', current_user_id,
    'buyerProfileId', buyer_profile_id,
    'sellerProfileId', seller_profile_id,
    'canBuy', not is_admin_account and coalesce(profile_record.can_buy, true),
    'canSell', should_sell,
    'phonePresent', nullif(regexp_replace(coalesce(profile_record.phone, ''), '[^0-9]', '', 'g'), '') is not null
  );
end;
$function$;