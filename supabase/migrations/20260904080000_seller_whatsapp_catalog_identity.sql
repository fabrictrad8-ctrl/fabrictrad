-- Seller WhatsApp catalogue identity, cross-role separation, and ingestion session state.

alter table public.seller_profiles
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists whatsapp_no text;

alter table public.seller_profiles drop constraint if exists seller_profiles_contact_email_check;
alter table public.seller_profiles add constraint seller_profiles_contact_email_check
  check (contact_email is null or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

alter table public.seller_profiles drop constraint if exists seller_profiles_contact_phone_check;
alter table public.seller_profiles add constraint seller_profiles_contact_phone_check
  check (contact_phone is null or right(regexp_replace(contact_phone, '[^0-9]', '', 'g'), 10) ~ '^[6-9][0-9]{9}$');

alter table public.seller_profiles drop constraint if exists seller_profiles_whatsapp_no_check;
alter table public.seller_profiles add constraint seller_profiles_whatsapp_no_check
  check (whatsapp_no is null or right(regexp_replace(whatsapp_no, '[^0-9]', '', 'g'), 10) ~ '^[6-9][0-9]{9}$');

create unique index if not exists seller_profiles_contact_email_unique_idx
  on public.seller_profiles (lower(trim(contact_email))) where contact_email is not null;
create unique index if not exists seller_profiles_contact_phone_unique_idx
  on public.seller_profiles (right(regexp_replace(contact_phone, '[^0-9]', '', 'g'), 10)) where contact_phone is not null;
create unique index if not exists seller_profiles_whatsapp_no_unique_idx
  on public.seller_profiles (right(regexp_replace(whatsapp_no, '[^0-9]', '', 'g'), 10)) where whatsapp_no is not null;

create table if not exists public.whatsapp_seller_catalog_sessions (
  seller_id uuid primary key references public.seller_profiles(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  whatsapp_no text not null,
  active_product_id uuid null references public.seller_products(id) on delete set null,
  active_sku text null,
  pending_draft jsonb not null default '{}'::jsonb,
  pending_media jsonb not null default '[]'::jsonb,
  last_message_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_seller_catalog_sessions_pending_draft_object check (jsonb_typeof(pending_draft)='object'),
  constraint whatsapp_seller_catalog_sessions_pending_media_array check (jsonb_typeof(pending_media)='array')
);

alter table public.whatsapp_seller_catalog_sessions enable row level security;
create index if not exists whatsapp_seller_catalog_sessions_phone_idx
  on public.whatsapp_seller_catalog_sessions (right(regexp_replace(whatsapp_no, '[^0-9]', '', 'g'),10));
create index if not exists whatsapp_seller_catalog_sessions_expiry_idx
  on public.whatsapp_seller_catalog_sessions (expires_at);

create or replace function public.enforce_seller_buyer_identity_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare conflict_field text;
begin
  if coalesce(new.is_active,true) = false then return new; end if;
  select case
    when new.contact_name is not null and lower(trim(coalesce(up.full_name,''))) = lower(trim(new.contact_name)) then 'name'
    when new.contact_name is not null and lower(trim(coalesce(bp.business_name,''))) = lower(trim(new.contact_name)) then 'name'
    when new.contact_email is not null and lower(trim(up.email)) = lower(trim(new.contact_email)) then 'email'
    when new.contact_phone is not null and right(regexp_replace(coalesce(up.phone,''),'[^0-9]','','g'),10)=right(regexp_replace(new.contact_phone,'[^0-9]','','g'),10) then 'phone'
    when new.whatsapp_no is not null and right(regexp_replace(coalesce(up.phone,''),'[^0-9]','','g'),10)=right(regexp_replace(new.whatsapp_no,'[^0-9]','','g'),10) then 'whatsapp'
    else null end
  into conflict_field
  from public.buyer_profiles bp
  join public.user_profiles up on up.id=bp.user_id
  where coalesce(bp.is_active,true)=true and (
    (new.contact_name is not null and (lower(trim(coalesce(up.full_name,'')))=lower(trim(new.contact_name)) or lower(trim(coalesce(bp.business_name,'')))=lower(trim(new.contact_name))))
    or (new.contact_email is not null and lower(trim(up.email))=lower(trim(new.contact_email)))
    or (new.contact_phone is not null and right(regexp_replace(coalesce(up.phone,''),'[^0-9]','','g'),10)=right(regexp_replace(new.contact_phone,'[^0-9]','','g'),10))
    or (new.whatsapp_no is not null and right(regexp_replace(coalesce(up.phone,''),'[^0-9]','','g'),10)=right(regexp_replace(new.whatsapp_no,'[^0-9]','','g'),10))
  ) limit 1;
  if conflict_field is not null then
    raise exception 'SELLER_BUYER_IDENTITY_CONFLICT:%', conflict_field using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seller_buyer_identity_separation on public.seller_profiles;
create trigger trg_seller_buyer_identity_separation
before insert or update of contact_name,contact_email,contact_phone,whatsapp_no,is_active
on public.seller_profiles for each row execute function public.enforce_seller_buyer_identity_separation();

create or replace function public.enforce_buyer_seller_identity_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer_email text;
  buyer_phone text;
  buyer_name text;
  conflict_field text;
begin
  if coalesce(new.is_active,true)=false then return new; end if;
  select lower(trim(email)), right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10), lower(trim(full_name))
    into buyer_email,buyer_phone,buyer_name from public.user_profiles where id=new.user_id;
  select case
    when sp.contact_name is not null and (lower(trim(sp.contact_name))=buyer_name or lower(trim(sp.contact_name))=lower(trim(coalesce(new.business_name,'')))) then 'name'
    when sp.contact_email is not null and lower(trim(sp.contact_email))=buyer_email then 'email'
    when sp.contact_phone is not null and right(regexp_replace(sp.contact_phone,'[^0-9]','','g'),10)=buyer_phone then 'phone'
    when sp.whatsapp_no is not null and right(regexp_replace(sp.whatsapp_no,'[^0-9]','','g'),10)=buyer_phone then 'whatsapp'
    else null end
  into conflict_field
  from public.seller_profiles sp
  where coalesce(sp.is_active,true)=true and (
    (sp.contact_name is not null and (lower(trim(sp.contact_name))=buyer_name or lower(trim(sp.contact_name))=lower(trim(coalesce(new.business_name,'')))))
    or (sp.contact_email is not null and lower(trim(sp.contact_email))=buyer_email)
    or (sp.contact_phone is not null and right(regexp_replace(sp.contact_phone,'[^0-9]','','g'),10)=buyer_phone)
    or (sp.whatsapp_no is not null and right(regexp_replace(sp.whatsapp_no,'[^0-9]','','g'),10)=buyer_phone)
  ) limit 1;
  if conflict_field is not null then
    raise exception 'BUYER_SELLER_IDENTITY_CONFLICT:%', conflict_field using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_buyer_seller_identity_separation on public.buyer_profiles;
create trigger trg_buyer_seller_identity_separation
before insert or update of business_name,user_id,is_active
on public.buyer_profiles for each row execute function public.enforce_buyer_seller_identity_separation();

create or replace function public.seller_identity_conflicts(
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_whatsapp_no text
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct field order by field), '{}'::text[])
  from (
    select unnest(array_remove(array[
      case when p_contact_name is not null and (lower(trim(coalesce(up.full_name,'')))=lower(trim(p_contact_name)) or lower(trim(coalesce(bp.business_name,'')))=lower(trim(p_contact_name))) then 'name' end,
      case when p_contact_email is not null and lower(trim(up.email))=lower(trim(p_contact_email)) then 'email' end,
      case when p_contact_phone is not null and right(regexp_replace(coalesce(up.phone,''),'[^0-9]','','g'),10)=right(regexp_replace(p_contact_phone,'[^0-9]','','g'),10) then 'phone' end,
      case when p_whatsapp_no is not null and right(regexp_replace(coalesce(up.phone,''),'[^0-9]','','g'),10)=right(regexp_replace(p_whatsapp_no,'[^0-9]','','g'),10) then 'whatsapp' end
    ], null)) as field
    from public.buyer_profiles bp
    join public.user_profiles up on up.id=bp.user_id
    where coalesce(bp.is_active,true)=true
  ) conflicts;
$$;

revoke all on function public.seller_identity_conflicts(text,text,text,text) from public;
grant execute on function public.seller_identity_conflicts(text,text,text,text) to service_role;
