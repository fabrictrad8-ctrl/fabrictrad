begin;

-- The production Razorpay order route persists transfer_status for every new
-- payment attempt. Keep both payment ledgers aligned with the application
-- contract so the first real payment cannot fail after Razorpay creates it.
alter table public.catalog_order_payments
  add column if not exists transfer_status text not null default 'not_configured';

alter table public.bulk_order_payments
  add column if not exists transfer_status text not null default 'not_configured';

-- A seller application is considered submitted only when the three mandatory
-- documents exist. Enforce this in the database as well as in the API.
create or replace function public.mark_seller_application_documents_uploaded()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  seller_record_id uuid;
  registration_record_id uuid;
  required_document_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select seller.id, registration.id
  into seller_record_id, registration_record_id
  from public.seller_profiles seller
  join public.seller_registrations registration
    on registration.user_id = seller.user_id
  where seller.user_id = current_user_id
  order by registration.updated_at desc
  limit 1;

  if seller_record_id is null or registration_record_id is null then
    raise exception 'Seller application not found';
  end if;

  select count(distinct document_type)::integer
  into required_document_count
  from public.seller_registration_documents
  where registration_id = registration_record_id
    and document_type in ('gst_certificate', 'pan_card', 'cancelled_cheque')
    and upload_status in ('uploaded', 'under_review', 'approved');

  if required_document_count < 3 then
    raise exception 'Upload the GST certificate, PAN card and cancelled cheque or bank statement before submitting the seller application';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.seller_registrations
  set registration_status = 'documents_uploaded',
      updated_at = now()
  where id = registration_record_id;

  update public.seller_profiles
  set verification_status = 'documents_submitted'::public.seller_status,
      updated_at = now()
  where id = seller_record_id;
end;
$$;

revoke execute on function public.mark_seller_application_documents_uploaded() from public, anon;
grant execute on function public.mark_seller_application_documents_uploaded() to authenticated, service_role;

-- Protect every code path (including legacy/admin-backed endpoints) from
-- advancing a registration without the exact mandatory documents.
create or replace function public.enforce_required_seller_documents_for_registration_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  required_document_count integer := 0;
  required_status text[];
begin
  if new.registration_status is not distinct from old.registration_status then
    return new;
  end if;

  if new.registration_status not in ('documents_uploaded', 'under_review', 'approved') then
    return new;
  end if;

  required_status := case
    when new.registration_status = 'approved' then array['approved']::text[]
    else array['uploaded', 'under_review', 'approved']::text[]
  end;

  select count(distinct document_type)::integer
  into required_document_count
  from public.seller_registration_documents
  where registration_id = new.id
    and document_type in ('gst_certificate', 'pan_card', 'cancelled_cheque')
    and upload_status = any(required_status);

  if required_document_count < 3 then
    raise exception 'GST certificate, PAN card and cancelled cheque or bank statement are required before advancing seller review' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_required_seller_documents_for_registration_status_trigger
  on public.seller_registrations;
create trigger enforce_required_seller_documents_for_registration_status_trigger
before update of registration_status on public.seller_registrations
for each row execute function public.enforce_required_seller_documents_for_registration_status();

create or replace function public.enforce_required_seller_documents_for_profile_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_record_id uuid;
  required_document_count integer := 0;
begin
  if new.verification_status is not distinct from old.verification_status
     or new.verification_status <> 'documents_submitted'::public.seller_status then
    return new;
  end if;

  select id into registration_record_id
  from public.seller_registrations
  where user_id = new.user_id
  order by updated_at desc
  limit 1;

  if registration_record_id is null then
    raise exception 'Seller registration is required before document submission status' using errcode = '23514';
  end if;

  select count(distinct document_type)::integer
  into required_document_count
  from public.seller_registration_documents
  where registration_id = registration_record_id
    and document_type in ('gst_certificate', 'pan_card', 'cancelled_cheque')
    and upload_status in ('uploaded', 'under_review', 'approved');

  if required_document_count < 3 then
    raise exception 'GST certificate, PAN card and cancelled cheque or bank statement are required before document submission status' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_required_seller_documents_for_profile_status_trigger
  on public.seller_profiles;
create trigger enforce_required_seller_documents_for_profile_status_trigger
before update of verification_status on public.seller_profiles
for each row execute function public.enforce_required_seller_documents_for_profile_status();

commit;
