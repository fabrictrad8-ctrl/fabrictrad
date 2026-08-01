-- Prevent any UI or direct API call from marking a seller verified before all checks pass.

create or replace function public.enforce_seller_verification_before_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone_verified boolean := false;
  v_required_documents_approved integer := 0;
  v_bank_verified boolean := false;
  v_registration_id uuid;
begin
  if new.verification_status = 'verified'::public.seller_status
     and old.verification_status is distinct from new.verification_status then
    select coalesce(up.phone_verified, false)
      into v_phone_verified
    from public.user_profiles up
    where up.id = new.user_id;

    select sr.id
      into v_registration_id
    from public.seller_registrations sr
    where sr.user_id = new.user_id
    order by sr.updated_at desc
    limit 1;

    if v_registration_id is not null then
      select count(distinct d.document_type)
        into v_required_documents_approved
      from public.seller_registration_documents d
      where d.registration_id = v_registration_id
        and d.document_type in ('gst_certificate', 'pan_card', 'cancelled_cheque')
        and d.upload_status = 'approved';
    end if;

    select coalesce(bool_or(bp.is_verified), false)
      into v_bank_verified
    from public.seller_bank_profiles bp
    where bp.seller_id = new.id;

    if not v_phone_verified then
      raise exception 'Seller mobile number must be OTP verified before approval.' using errcode = '23514';
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

drop trigger if exists enforce_seller_verification_before_approval on public.seller_profiles;
create trigger enforce_seller_verification_before_approval
before update of verification_status on public.seller_profiles
for each row
execute function public.enforce_seller_verification_before_approval();
