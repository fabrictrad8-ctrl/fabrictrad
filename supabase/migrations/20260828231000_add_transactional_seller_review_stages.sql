create or replace function public.admin_review_seller_stage(
  p_seller_id uuid,
  p_admin_id uuid,
  p_action text,
  p_document_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_seller public.seller_profiles%rowtype;
  v_registration public.seller_registrations%rowtype;
  v_bank public.seller_bank_profiles%rowtype;
  v_document public.seller_registration_documents%rowtype;
  v_admin_authorized boolean := false;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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

  if v_seller.verification_status = 'verified'::public.seller_status then
    raise exception 'This seller is already verified. Use the seller status controls to suspend or reopen review.' using errcode = '23514';
  end if;

  select * into v_registration
  from public.seller_registrations
  where user_id = v_seller.user_id
  order by updated_at desc
  limit 1
  for update;

  if v_registration.id is null then
    raise exception 'Seller registration was not found.' using errcode = 'P0002';
  end if;

  if p_action = 'confirm_gstin' then
    if nullif(btrim(coalesce(v_seller.gstin, '')), '') is null
       or nullif(btrim(coalesce(v_registration.gstin, '')), '') is null then
      raise exception 'GSTIN must be submitted before it can be confirmed.' using errcode = '23514';
    end if;
    if upper(btrim(v_seller.gstin)) <> upper(btrim(v_registration.gstin)) then
      raise exception 'Seller profile GSTIN does not match the submitted registration GSTIN.' using errcode = '23514';
    end if;

    update public.seller_profiles
    set gstin_verified = true,
        gstin_status = 'active',
        gstin_last_checked_at = v_now,
        gstin_verification_provider = coalesce(nullif(gstin_verification_provider, ''), 'admin_manual_review'),
        verification_status = 'manual_review'::public.seller_status,
        updated_at = v_now
    where id = p_seller_id;

    update public.seller_registrations
    set gstin_verified = true,
        gstin_verified_at = v_now,
        registration_status = case when registration_status = 'approved' then registration_status else 'under_review' end,
        rejection_reason = null,
        updated_at = v_now
    where id = v_registration.id;

  elsif p_action = 'reject_gstin' then
    if v_reason is null or length(v_reason) < 5 then
      raise exception 'A clear GSTIN rejection reason is required.' using errcode = '23514';
    end if;

    update public.seller_profiles
    set gstin_verified = false,
        gstin_status = 'invalid',
        gstin_last_checked_at = v_now,
        gstin_verification_provider = coalesce(nullif(gstin_verification_provider, ''), 'admin_manual_review'),
        verification_status = 'additional_docs_required'::public.seller_status,
        settlement_eligible = false,
        updated_at = v_now
    where id = p_seller_id;

    update public.seller_registrations
    set gstin_verified = false,
        gstin_verified_at = null,
        registration_status = 'under_review',
        rejection_reason = v_reason,
        approved_at = null,
        updated_at = v_now
    where id = v_registration.id;

  elsif p_action in ('approve_document', 'reject_document') then
    if p_document_id is null then
      raise exception 'A document must be selected for review.' using errcode = '23514';
    end if;

    select * into v_document
    from public.seller_registration_documents
    where id = p_document_id
      and registration_id = v_registration.id
    for update;

    if v_document.id is null then
      raise exception 'The selected document does not belong to the current seller application.' using errcode = '23514';
    end if;

    if p_action = 'reject_document' and (v_reason is null or length(v_reason) < 5) then
      raise exception 'A clear document rejection reason is required.' using errcode = '23514';
    end if;

    update public.seller_registration_documents
    set upload_status = case when p_action = 'approve_document' then 'approved' else 'rejected' end,
        rejection_reason = case when p_action = 'approve_document' then null else v_reason end,
        reviewed_by = p_admin_id,
        reviewed_at = v_now,
        updated_at = v_now
    where id = v_document.id;

    update public.seller_profiles
    set verification_status = case
          when p_action = 'approve_document' then 'manual_review'::public.seller_status
          else 'additional_docs_required'::public.seller_status
        end,
        settlement_eligible = false,
        updated_at = v_now
    where id = p_seller_id;

    update public.seller_registrations
    set registration_status = 'under_review',
        rejection_reason = case when p_action = 'approve_document' then rejection_reason else v_reason end,
        approved_at = null,
        updated_at = v_now
    where id = v_registration.id;

  elsif p_action = 'verify_bank' then
    select * into v_bank
    from public.seller_bank_profiles
    where seller_id = p_seller_id
    order by updated_at desc
    limit 1
    for update;

    if v_bank.id is null
       or nullif(btrim(coalesce(v_bank.account_number_masked, '')), '') is null
       or nullif(btrim(coalesce(v_bank.ifsc_code, '')), '') is null then
      raise exception 'Complete settlement bank details are required before verification.' using errcode = '23514';
    end if;

    update public.seller_bank_profiles
    set is_verified = true,
        updated_at = v_now
    where id = v_bank.id;

    update public.seller_registrations
    set bank_verified = true,
        bank_verified_at = v_now,
        registration_status = case when registration_status = 'approved' then registration_status else 'under_review' end,
        rejection_reason = null,
        updated_at = v_now
    where id = v_registration.id;

    update public.seller_profiles
    set verification_status = 'manual_review'::public.seller_status,
        settlement_eligible = false,
        updated_at = v_now
    where id = p_seller_id;

  elsif p_action = 'reject_bank' then
    if v_reason is null or length(v_reason) < 5 then
      raise exception 'A clear bank rejection reason is required.' using errcode = '23514';
    end if;

    select * into v_bank
    from public.seller_bank_profiles
    where seller_id = p_seller_id
    order by updated_at desc
    limit 1
    for update;

    if v_bank.id is null then
      raise exception 'Settlement bank profile was not found.' using errcode = 'P0002';
    end if;

    update public.seller_bank_profiles
    set is_verified = false,
        updated_at = v_now
    where id = v_bank.id;

    update public.seller_registrations
    set bank_verified = false,
        bank_verified_at = null,
        registration_status = 'under_review',
        rejection_reason = v_reason,
        approved_at = null,
        updated_at = v_now
    where id = v_registration.id;

    update public.seller_profiles
    set verification_status = 'additional_docs_required'::public.seller_status,
        settlement_eligible = false,
        updated_at = v_now
    where id = p_seller_id;

  elsif p_action = 'reject_seller' then
    if v_reason is null or length(v_reason) < 5 then
      raise exception 'A clear seller rejection reason is required.' using errcode = '23514';
    end if;

    update public.seller_profiles
    set verification_status = 'rejected'::public.seller_status,
        settlement_eligible = false,
        is_active = false,
        updated_at = v_now
    where id = p_seller_id;

    update public.seller_registrations
    set registration_status = 'rejected',
        rejection_reason = v_reason,
        approved_at = null,
        updated_at = v_now
    where id = v_registration.id;

  else
    raise exception 'Unsupported seller review action.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'sellerId', p_seller_id,
    'registrationId', v_registration.id,
    'action', p_action,
    'updated', true,
    'reviewedAt', v_now
  );
end;
$function$;

revoke all on function public.admin_review_seller_stage(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_review_seller_stage(uuid, uuid, text, uuid, text) to service_role;
