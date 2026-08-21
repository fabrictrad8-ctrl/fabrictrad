-- One admin decision approves a complete seller application atomically.
-- The function is callable only by the server-side service role.

create or replace function public.admin_approve_seller(
  p_seller_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seller public.seller_profiles%rowtype;
  v_registration public.seller_registrations%rowtype;
  v_bank public.seller_bank_profiles%rowtype;
  v_required text[] := array['gst_certificate','pan_card','cancelled_cheque'];
  v_uploaded integer := 0;
  v_now timestamptz := now();
begin
  select * into v_seller
  from public.seller_profiles
  where id = p_seller_id
  for update;

  if not found then
    raise exception 'Seller application not found.' using errcode = 'P0002';
  end if;

  select * into v_registration
  from public.seller_registrations
  where user_id = v_seller.user_id
  order by updated_at desc
  limit 1
  for update;

  if v_registration.id is null or v_registration.submitted_at is null then
    raise exception 'The seller has not completed and submitted the application.' using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(v_seller.gstin, '')), '') is null then
    raise exception 'GSTIN is missing from the seller application.' using errcode = 'P0001';
  end if;

  select * into v_bank
  from public.seller_bank_profiles
  where seller_id = p_seller_id
  order by updated_at desc
  limit 1
  for update;

  if v_bank.id is null
     or nullif(btrim(coalesce(v_bank.account_number_masked, '')), '') is null
     or nullif(btrim(coalesce(v_bank.ifsc_code, '')), '') is null then
    raise exception 'Settlement account details are missing.' using errcode = 'P0001';
  end if;

  select count(distinct document_type)
  into v_uploaded
  from public.seller_registration_documents
  where registration_id = v_registration.id
    and document_type = any(v_required)
    and upload_status in ('uploaded','under_review','approved');

  if v_uploaded < cardinality(v_required) then
    raise exception 'All three required documents must be uploaded before approval.' using errcode = 'P0001';
  end if;

  update public.seller_registration_documents
  set upload_status = 'approved',
      rejection_reason = null,
      reviewed_by = p_admin_id,
      reviewed_at = v_now,
      updated_at = v_now
  where registration_id = v_registration.id
    and document_type = any(v_required)
    and upload_status in ('uploaded','under_review','approved','rejected');

  update public.seller_bank_profiles
  set is_verified = true,
      updated_at = v_now
  where id = v_bank.id;

  update public.seller_registrations
  set gstin_verified = true,
      gstin_verified_at = v_now,
      bank_verified = true,
      bank_verified_at = v_now,
      registration_status = 'approved',
      approved_at = v_now,
      rejection_reason = null,
      updated_at = v_now
  where id = v_registration.id;

  update public.seller_profiles
  set gstin_status = 'active',
      gstin_verified = true,
      verification_status = 'verified'::public.seller_status,
      settlement_eligible = true,
      is_active = true,
      updated_at = v_now
  where id = p_seller_id;

  return jsonb_build_object(
    'sellerId', p_seller_id,
    'registrationId', v_registration.id,
    'approved', true,
    'approvedAt', v_now
  );
end;
$$;

revoke all on function public.admin_approve_seller(uuid, uuid) from public;
revoke all on function public.admin_approve_seller(uuid, uuid) from anon;
revoke all on function public.admin_approve_seller(uuid, uuid) from authenticated;
grant execute on function public.admin_approve_seller(uuid, uuid) to service_role;
