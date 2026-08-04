create or replace function public.protect_seller_profile_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.gstin_verified is distinct from old.gstin_verified
     or new.gstin_status is distinct from old.gstin_status
     or new.gstin_legal_name is distinct from old.gstin_legal_name
     or new.gstin_trade_name is distinct from old.gstin_trade_name
     or new.gstin_state_code is distinct from old.gstin_state_code
     or new.gstin_taxpayer_type is distinct from old.gstin_taxpayer_type
     or new.gstin_registration_date is distinct from old.gstin_registration_date
     or new.gstin_cancellation_date is distinct from old.gstin_cancellation_date
     or new.gstin_last_checked_at is distinct from old.gstin_last_checked_at
     or new.gstin_verification_provider is distinct from old.gstin_verification_provider
     or new.verification_status is distinct from old.verification_status
     or new.settlement_eligible is distinct from old.settlement_eligible
     or new.razorpay_linked_account_id is distinct from old.razorpay_linked_account_id
     or new.e_invoice_applicable is distinct from old.e_invoice_applicable
     or new.is_active is distinct from old.is_active then
    raise exception 'Seller verification, activation and settlement fields are managed by FabricTrad.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_seller_profile_review_fields_trigger on public.seller_profiles;
create trigger protect_seller_profile_review_fields_trigger
before update on public.seller_profiles
for each row execute function public.protect_seller_profile_review_fields();

create or replace function public.protect_seller_document_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.upload_status not in ('uploaded', 'under_review')
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.rejection_reason is not null then
      raise exception 'Document review fields are managed by FabricTrad.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.upload_status in ('approved', 'rejected')
     and new.upload_status is distinct from old.upload_status then
    raise exception 'Only FabricTrad can approve or reject seller documents.' using errcode = '42501';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Document review fields are managed by FabricTrad.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_seller_document_review_fields_trigger on public.seller_registration_documents;
create trigger protect_seller_document_review_fields_trigger
before insert or update on public.seller_registration_documents
for each row execute function public.protect_seller_document_review_fields();

create or replace function public.protect_seller_bank_verification_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false)
       or new.razorpay_fund_account_id is not null then
      raise exception 'Bank verification and payout linkage are managed by FabricTrad.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified
     or new.razorpay_fund_account_id is distinct from old.razorpay_fund_account_id then
    raise exception 'Bank verification and payout linkage are managed by FabricTrad.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_seller_bank_verification_fields_trigger on public.seller_bank_profiles;
create trigger protect_seller_bank_verification_fields_trigger
before insert or update on public.seller_bank_profiles
for each row execute function public.protect_seller_bank_verification_fields();

create or replace function public.protect_product_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.approval_status not in ('not_submitted', 'pending')
       or new.admin_review_notes is not null then
      raise exception 'Product approval fields are managed by FabricTrad.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.approval_status in ('approved', 'rejected')
     and new.approval_status is distinct from old.approval_status then
    raise exception 'Only FabricTrad can approve or reject products.' using errcode = '42501';
  end if;
  if new.admin_review_notes is distinct from old.admin_review_notes then
    raise exception 'Product review notes are managed by FabricTrad.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_product_review_fields_trigger on public.seller_products;
create trigger protect_product_review_fields_trigger
before insert or update on public.seller_products
for each row execute function public.protect_product_review_fields();

drop trigger if exists protect_product_variant_review_fields_trigger on public.seller_product_variants;
create trigger protect_product_variant_review_fields_trigger
before insert or update on public.seller_product_variants
for each row execute function public.protect_product_review_fields();
