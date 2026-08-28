create or replace function public.admin_approve_seller(p_seller_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_seller public.seller_profiles%rowtype;
  v_registration public.seller_registrations%rowtype;
  v_bank public.seller_bank_profiles%rowtype;
  v_required text[] := array['gst_certificate','pan_card','cancelled_cheque'];
  v_approved integer := 0;
  v_phone_present boolean := false;
  v_admin_authorized boolean := false;
  v_now timestamptz := now();
begin
  select exists(
    select 1
    from public.user_profiles up
    where up.id = p_admin_id
      and lower(coalesce(up.email, '')) = 'fabrictrad8@gmail.com'
      and up.is_active = true
      and up.role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
  ) into v_admin_authorized;

  if not v_admin_authorized then
    raise exception 'Administrator authorization is required.' using errcode = '42501';
  end if;

  select * into v_seller
  from public.seller_profiles
  where id = p_seller_id
  for update;

  if not found then
    raise exception 'Seller application not found.' using errcode = 'P0002';
  end if;

  select nullif(btrim(coalesce(up.phone, '')), '') is not null
    into v_phone_present
  from public.user_profiles up
  where up.id = v_seller.user_id;

  if not coalesce(v_phone_present, false) then
    raise exception 'Seller mobile number must be added before final approval.' using errcode = '23514';
  end if;

  select * into v_registration
  from public.seller_registrations
  where user_id = v_seller.user_id
  order by updated_at desc
  limit 1
  for update;

  if v_registration.id is null or v_registration.submitted_at is null then
    raise exception 'The seller has not completed and submitted the application.' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(v_seller.gstin, '')), '') is null
     or not coalesce(v_seller.gstin_verified, false)
     or coalesce(v_seller.gstin_status, '') <> 'active'
     or not coalesce(v_registration.gstin_verified, false) then
    raise exception 'GSTIN review must be completed before final seller approval.' using errcode = '23514';
  end if;

  select count(distinct d.document_type)
    into v_approved
  from public.seller_registration_documents d
  where d.registration_id = v_registration.id
    and d.document_type = any(v_required)
    and d.upload_status = 'approved';

  if v_approved < cardinality(v_required) then
    raise exception 'All required documents must be individually approved before final seller approval.' using errcode = '23514';
  end if;

  select * into v_bank
  from public.seller_bank_profiles
  where seller_id = p_seller_id
  order by updated_at desc
  limit 1
  for update;

  if v_bank.id is null
     or nullif(btrim(coalesce(v_bank.account_number_masked, '')), '') is null
     or nullif(btrim(coalesce(v_bank.ifsc_code, '')), '') is null
     or not coalesce(v_bank.is_verified, false)
     or not coalesce(v_registration.bank_verified, false) then
    raise exception 'Settlement bank review must be completed before final seller approval.' using errcode = '23514';
  end if;

  update public.seller_registrations
  set registration_status = 'approved',
      approved_at = coalesce(approved_at, v_now),
      rejection_reason = null,
      updated_at = v_now
  where id = v_registration.id;

  update public.seller_profiles
  set verification_status = 'verified'::public.seller_status,
      settlement_eligible = true,
      is_active = true,
      updated_at = v_now
  where id = p_seller_id;

  return jsonb_build_object(
    'sellerId', p_seller_id,
    'registrationId', v_registration.id,
    'approved', true,
    'approvedAt', v_now,
    'stagedChecksRequired', true
  );
end;
$function$;

revoke all on function public.admin_approve_seller(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_seller(uuid, uuid) to service_role;
