-- FabricTrad business KYC, GSTIN/GTIN and buyer-specific quantity controls.
-- GSTIN never removes GST. It enables a B2B tax invoice and may support eligible ITC.

alter table public.buyer_profiles
  add column if not exists gst_registration_status text not null default 'not_declared',
  add column if not exists business_kyc_status text not null default 'not_required',
  add column if not exists pan_last4 text,
  add column if not exists gstin_status text not null default 'not_provided',
  add column if not exists gstin_legal_name text,
  add column if not exists gstin_trade_name text,
  add column if not exists gstin_state_code text,
  add column if not exists gstin_taxpayer_type text,
  add column if not exists gstin_registration_date date,
  add column if not exists gstin_cancellation_date date,
  add column if not exists gstin_last_checked_at timestamptz,
  add column if not exists gstin_verification_provider text;

alter table public.seller_profiles
  add column if not exists gstin_status text not null default 'not_provided',
  add column if not exists gstin_legal_name text,
  add column if not exists gstin_trade_name text,
  add column if not exists gstin_state_code text,
  add column if not exists gstin_taxpayer_type text,
  add column if not exists gstin_registration_date date,
  add column if not exists gstin_cancellation_date date,
  add column if not exists gstin_last_checked_at timestamptz,
  add column if not exists gstin_verification_provider text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'buyer_profiles_gst_registration_status_check') then
    alter table public.buyer_profiles add constraint buyer_profiles_gst_registration_status_check
      check (gst_registration_status in ('not_declared', 'unregistered', 'registered'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buyer_profiles_business_kyc_status_check') then
    alter table public.buyer_profiles add constraint buyer_profiles_business_kyc_status_check
      check (business_kyc_status in ('not_required', 'pending', 'verified', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buyer_profiles_gstin_status_check') then
    alter table public.buyer_profiles add constraint buyer_profiles_gstin_status_check
      check (gstin_status in ('not_provided', 'format_valid', 'pending_provider', 'active', 'inactive', 'cancelled', 'invalid', 'manual_review'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_profiles_gstin_status_check') then
    alter table public.seller_profiles add constraint seller_profiles_gstin_status_check
      check (gstin_status in ('not_provided', 'format_valid', 'pending_provider', 'active', 'inactive', 'cancelled', 'invalid', 'manual_review'));
  end if;
end $$;

update public.buyer_profiles
set gst_registration_status = case when nullif(trim(gstin), '') is null then 'unregistered' else 'registered' end,
    business_kyc_status = case when buyer_type = 'end_user' then 'not_required' else 'pending' end,
    gstin_status = case
      when coalesce(gstin_verified, false) then 'active'
      when nullif(trim(gstin), '') is not null then 'manual_review'
      else 'not_provided'
    end
where gst_registration_status = 'not_declared';

update public.seller_profiles
set gstin_status = case
  when coalesce(gstin_verified, false) then 'active'
  when nullif(trim(gstin), '') is not null then 'manual_review'
  else 'not_provided'
end
where gstin_status = 'not_provided';

create table if not exists public.gstin_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null,
  subject_profile_id uuid,
  gstin text not null,
  format_valid boolean not null default false,
  checksum_valid boolean not null default false,
  verification_status text not null default 'pending_provider',
  legal_name text,
  trade_name text,
  state_code text,
  taxpayer_type text,
  registration_date date,
  cancellation_date date,
  principal_place text,
  provider text not null default 'manual_gst_portal',
  provider_reference text,
  raw_response jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gstin_verifications_subject_type_check check (subject_type in ('buyer', 'seller')),
  constraint gstin_verifications_status_check check (verification_status in ('format_valid', 'pending_provider', 'active', 'inactive', 'cancelled', 'invalid', 'manual_review')),
  constraint gstin_verifications_gstin_check check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  unique (owner_user_id, subject_type, gstin)
);

create index if not exists gstin_verifications_gstin_idx on public.gstin_verifications (gstin, verification_status);
create index if not exists gstin_verifications_owner_idx on public.gstin_verifications (owner_user_id, checked_at desc);

alter table public.gstin_verifications enable row level security;

drop policy if exists "Owners view their GSTIN checks" on public.gstin_verifications;
create policy "Owners view their GSTIN checks"
on public.gstin_verifications for select to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role in ('admin_staff', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Owners submit their GSTIN checks" on public.gstin_verifications;
create policy "Owners submit their GSTIN checks"
on public.gstin_verifications for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "Owners refresh their GSTIN checks" on public.gstin_verifications;
create policy "Owners refresh their GSTIN checks"
on public.gstin_verifications for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create table if not exists public.business_kyc_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  buyer_profile_id uuid references public.buyer_profiles(id) on delete cascade,
  seller_profile_id uuid references public.seller_profiles(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null,
  verification_status text not null default 'uploaded',
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_kyc_documents_subject_check check (buyer_profile_id is not null or seller_profile_id is not null),
  constraint business_kyc_documents_type_check check (document_type in ('gst_certificate', 'pan_card', 'aadhaar_offline_ekyc', 'business_proof', 'address_proof', 'cancelled_cheque')),
  constraint business_kyc_documents_status_check check (verification_status in ('uploaded', 'pending', 'verified', 'rejected')),
  constraint business_kyc_documents_file_size_check check (file_size > 0 and file_size <= 10485760),
  unique (owner_user_id, document_type, buyer_profile_id, seller_profile_id)
);

create index if not exists business_kyc_documents_owner_idx on public.business_kyc_documents (owner_user_id, created_at desc);
create index if not exists business_kyc_documents_buyer_idx on public.business_kyc_documents (buyer_profile_id) where buyer_profile_id is not null;
create index if not exists business_kyc_documents_seller_idx on public.business_kyc_documents (seller_profile_id) where seller_profile_id is not null;

alter table public.business_kyc_documents enable row level security;

drop policy if exists "Owners view their business KYC documents" on public.business_kyc_documents;
create policy "Owners view their business KYC documents"
on public.business_kyc_documents for select to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.role in ('admin_staff', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Owners upload business KYC metadata" on public.business_kyc_documents;
create policy "Owners upload business KYC metadata"
on public.business_kyc_documents for insert to authenticated
with check (owner_user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-kyc-documents',
  'business-kyc-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/xml', 'text/xml']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload private business KYC files" on storage.objects;
create policy "Owners upload private business KYC files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-kyc-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners view private business KYC files" on storage.objects;
create policy "Owners view private business KYC files"
on storage.objects for select to authenticated
using (
  bucket_id = 'business-kyc-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role in ('admin_staff', 'super_admin') and p.is_active = true
    )
  )
);

drop policy if exists "Owners replace private business KYC files" on storage.objects;
create policy "Owners replace private business KYC files"
on storage.objects for update to authenticated
using (bucket_id = 'business-kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'business-kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.seller_products
  add column if not exists gtin text,
  add column if not exists gtin_status text not null default 'not_provided',
  add column if not exists gtin_verified_at timestamptz,
  add column if not exists hsn_code text,
  add column if not exists brand_name text,
  add column if not exists manufacturer_name text,
  add column if not exists country_of_origin text not null default 'India',
  add column if not exists gst_rate numeric(5,2) not null default 5,
  add column if not exists price_includes_gst boolean not null default false,
  add column if not exists retail_store_min_quantity numeric(14,2),
  add column if not exists retail_store_max_quantity numeric(14,2),
  add column if not exists end_user_enabled boolean not null default false,
  add column if not exists end_user_limit_mode text not null default 'custom',
  add column if not exists end_user_min_quantity numeric(14,2),
  add column if not exists end_user_max_quantity numeric(14,2);

alter table public.seller_product_variants
  add column if not exists gtin text,
  add column if not exists gtin_status text not null default 'not_provided',
  add column if not exists gtin_verified_at timestamptz,
  add column if not exists gst_rate numeric(5,2),
  add column if not exists price_includes_gst boolean,
  add column if not exists retail_store_min_quantity numeric(14,2),
  add column if not exists retail_store_max_quantity numeric(14,2),
  add column if not exists end_user_enabled boolean,
  add column if not exists end_user_limit_mode text,
  add column if not exists end_user_min_quantity numeric(14,2),
  add column if not exists end_user_max_quantity numeric(14,2);

update public.seller_products
set retail_store_min_quantity = coalesce(retail_store_min_quantity, greatest(moq, 1)),
    end_user_enabled = sale_channel in ('retail', 'both'),
    end_user_min_quantity = case when sale_channel in ('retail', 'both') then coalesce(end_user_min_quantity, 1) else end_user_min_quantity end,
    end_user_limit_mode = case when sale_channel in ('retail', 'both') then 'custom' else 'disabled' end
where retail_store_min_quantity is null
   or (sale_channel in ('retail', 'both') and end_user_min_quantity is null)
   or (sale_channel = 'b2b' and end_user_limit_mode <> 'disabled');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'seller_products_gtin_status_check') then
    alter table public.seller_products add constraint seller_products_gtin_status_check
      check (gtin_status in ('not_provided', 'format_valid', 'verified', 'invalid', 'manual_review'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_variants_gtin_status_check') then
    alter table public.seller_product_variants add constraint seller_variants_gtin_status_check
      check (gtin_status in ('not_provided', 'format_valid', 'verified', 'invalid', 'manual_review'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_products_end_user_limit_mode_check') then
    alter table public.seller_products add constraint seller_products_end_user_limit_mode_check
      check (end_user_limit_mode in ('same_as_retail_store', 'custom', 'disabled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_variants_end_user_limit_mode_check') then
    alter table public.seller_product_variants add constraint seller_variants_end_user_limit_mode_check
      check (end_user_limit_mode is null or end_user_limit_mode in ('same_as_retail_store', 'custom', 'disabled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_products_quantity_policy_check') then
    alter table public.seller_products add constraint seller_products_quantity_policy_check check (
      coalesce(retail_store_min_quantity, 0) >= 0
      and (retail_store_max_quantity is null or retail_store_max_quantity >= coalesce(retail_store_min_quantity, 0))
      and coalesce(end_user_min_quantity, 0) >= 0
      and (end_user_max_quantity is null or end_user_max_quantity >= coalesce(end_user_min_quantity, 0))
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seller_products_gst_rate_check') then
    alter table public.seller_products add constraint seller_products_gst_rate_check check (gst_rate >= 0 and gst_rate <= 100);
  end if;
end $$;

create index if not exists seller_products_gtin_idx on public.seller_products (gtin) where gtin is not null;
create index if not exists seller_product_variants_gtin_idx on public.seller_product_variants (gtin) where gtin is not null;

create or replace function public.valid_gtin(p_gtin text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  normalized text := regexp_replace(p_gtin, '\D', '', 'g');
  body text;
  expected integer;
  total integer := 0;
  digit integer;
  position_from_right integer := 1;
  i integer;
begin
  if length(normalized) not in (8, 12, 13, 14) then return false; end if;
  body := left(normalized, length(normalized) - 1);
  expected := right(normalized, 1)::integer;
  for i in reverse length(body)..1 loop
    digit := substr(body, i, 1)::integer;
    total := total + digit * case when position_from_right % 2 = 1 then 3 else 1 end;
    position_from_right := position_from_right + 1;
  end loop;
  return ((10 - (total % 10)) % 10) = expected;
end;
$$;

create or replace function public.normalize_commerce_identifiers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.gtin is not null then
    new.gtin := regexp_replace(new.gtin, '\D', '', 'g');
    if new.gtin = '' then
      new.gtin := null;
      new.gtin_status := 'not_provided';
    elsif public.valid_gtin(new.gtin) then
      if new.gtin_status in ('not_provided', 'invalid') then new.gtin_status := 'format_valid'; end if;
    else
      raise exception 'GTIN must be a valid GTIN-8, GTIN-12, GTIN-13 or GTIN-14 with a correct check digit';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seller_products_normalize_identifiers on public.seller_products;
create trigger seller_products_normalize_identifiers
before insert or update of gtin on public.seller_products
for each row execute function public.normalize_commerce_identifiers();

drop trigger if exists seller_variants_normalize_identifiers on public.seller_product_variants;
create trigger seller_variants_normalize_identifiers
before insert or update of gtin on public.seller_product_variants
for each row execute function public.normalize_commerce_identifiers();

alter table public.catalog_order_requests
  add column if not exists buyer_gstin text,
  add column if not exists buyer_gstin_verified boolean not null default false,
  add column if not exists seller_gstin text,
  add column if not exists seller_gstin_verified boolean not null default false,
  add column if not exists tax_invoice_type text not null default 'b2c',
  add column if not exists input_tax_credit_possible boolean not null default false,
  add column if not exists gst_rate numeric(5,2) not null default 5,
  add column if not exists price_includes_gst boolean not null default false,
  add column if not exists hsn_code text,
  add column if not exists place_of_supply_state text,
  add column if not exists intra_state_supply boolean,
  add column if not exists cgst_amount numeric(14,2) not null default 0,
  add column if not exists sgst_amount numeric(14,2) not null default 0,
  add column if not exists igst_amount numeric(14,2) not null default 0,
  add column if not exists tax_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catalog_order_requests_invoice_type_check') then
    alter table public.catalog_order_requests add constraint catalog_order_requests_invoice_type_check
      check (tax_invoice_type in ('b2c', 'b2b'));
  end if;
end $$;

create or replace function public.enforce_catalog_order_policy_and_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer public.buyer_profiles%rowtype;
  buyer_user public.user_profiles%rowtype;
  seller public.seller_profiles%rowtype;
  seller_user public.user_profiles%rowtype;
  product public.seller_products%rowtype;
  variant public.seller_product_variants%rowtype;
  rule public.seller_catalog_rules%rowtype;
  effective_min numeric;
  effective_max numeric;
  effective_mode text;
  effective_end_user_enabled boolean;
  effective_price numeric;
  effective_gst_rate numeric;
  effective_price_includes_gst boolean;
  available_to_sell numeric;
  buyer_state text;
  seller_state text;
  tax_total numeric;
  break_price numeric;
begin
  select * into buyer from public.buyer_profiles where user_id = new.buyer_id and is_active = true;
  if not found then raise exception 'Active buyer profile not found'; end if;
  select * into buyer_user from public.user_profiles where id = new.buyer_id and is_active = true;
  if not found or coalesce(buyer_user.can_buy, false) = false then raise exception 'Buying access is not enabled'; end if;

  select * into product from public.seller_products where id = new.product_id and status = 'active' and approval_status = 'approved';
  if not found then raise exception 'Product is not available for ordering'; end if;

  if new.variant_id is not null then
    select * into variant from public.seller_product_variants
    where id = new.variant_id and product_id = product.id and status = 'active' and approval_status = 'approved';
    if not found then raise exception 'Product variation is not available'; end if;
  else
    variant := null;
  end if;

  select * into seller from public.seller_profiles where id = product.seller_id and is_active = true;
  if not found then raise exception 'Seller profile is not active'; end if;
  select * into seller_user from public.user_profiles where id = seller.user_id;

  new.seller_id := product.seller_id;
  new.buyer_type := buyer.buyer_type;
  new.unit := coalesce(variant.unit, product.unit);
  available_to_sell := greatest(coalesce(variant.available_quantity, product.available_quantity) - coalesce(variant.reserved_quantity, product.reserved_quantity), 0);
  if new.quantity <= 0 or new.quantity > available_to_sell then
    raise exception 'Requested quantity is outside the available stock';
  end if;

  if buyer.buyer_type = 'end_user' then
    if product.sale_channel not in ('retail', 'both') then raise exception 'This listing is available only to business buyers'; end if;
    effective_end_user_enabled := coalesce(variant.end_user_enabled, product.end_user_enabled, false);
    effective_mode := coalesce(variant.end_user_limit_mode, product.end_user_limit_mode, 'disabled');
    if not effective_end_user_enabled or effective_mode = 'disabled' then raise exception 'Personal purchases are disabled for this listing'; end if;
    if effective_mode = 'same_as_retail_store' then
      effective_min := coalesce(variant.retail_store_min_quantity, product.retail_store_min_quantity, variant.moq, product.moq, 1);
      effective_max := coalesce(variant.retail_store_max_quantity, product.retail_store_max_quantity);
    else
      effective_min := coalesce(variant.end_user_min_quantity, product.end_user_min_quantity, 1);
      effective_max := coalesce(variant.end_user_max_quantity, product.end_user_max_quantity);
    end if;
  else
    effective_min := coalesce(variant.retail_store_min_quantity, product.retail_store_min_quantity, variant.moq, product.moq, 1);
    effective_max := coalesce(variant.retail_store_max_quantity, product.retail_store_max_quantity);
  end if;

  if new.quantity < greatest(effective_min, 0) then
    raise exception 'Minimum permitted quantity is % %', effective_min, new.unit;
  end if;
  if effective_max is not null and new.quantity > effective_max then
    raise exception 'Maximum permitted quantity is % %', effective_max, new.unit;
  end if;

  rule := null;
  if buyer.buyer_type = 'retail_store' then
    select r.* into rule
    from public.seller_catalog_rules r
    join public.seller_catalogs c on c.id = r.catalog_id
    where r.product_id = product.id
      and (r.variant_id is null or r.variant_id = new.variant_id)
      and c.seller_id = product.seller_id
      and c.status = 'active'
      and (c.scope = 'global' or c.company_id = new.company_id)
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
    order by (r.variant_id is not null) desc, (c.company_id is not null) desc, r.updated_at desc
    limit 1;
  end if;

  if rule.id is not null then
    if new.quantity < rule.minimum_quantity then raise exception 'Catalog minimum quantity is % %', rule.minimum_quantity, new.unit; end if;
    if rule.maximum_quantity is not null and new.quantity > rule.maximum_quantity then raise exception 'Catalog maximum quantity is % %', rule.maximum_quantity, new.unit; end if;
    effective_price := coalesce(rule.price_override, variant.price_per_unit, product.price_per_unit);
    select (entry->>'price')::numeric into break_price
    from jsonb_array_elements(coalesce(rule.price_breaks, '[]'::jsonb)) entry
    where (entry->>'minimum_quantity')::numeric <= new.quantity
    order by (entry->>'minimum_quantity')::numeric desc
    limit 1;
    effective_price := coalesce(break_price, effective_price);
  else
    effective_price := coalesce(variant.price_per_unit, product.price_per_unit);
  end if;

  effective_gst_rate := coalesce(variant.gst_rate, product.gst_rate, 0);
  effective_price_includes_gst := coalesce(variant.price_includes_gst, product.price_includes_gst, false);
  new.price_per_unit := round(effective_price, 2);
  new.subtotal := round(new.quantity * effective_price, 2);
  new.gst_rate := effective_gst_rate;
  new.price_includes_gst := effective_price_includes_gst;
  new.hsn_code := product.hsn_code;

  if effective_price_includes_gst and effective_gst_rate > 0 then
    tax_total := round(new.subtotal - (new.subtotal / (1 + effective_gst_rate / 100)), 2);
    new.total_amount := new.subtotal;
  else
    tax_total := round(new.subtotal * effective_gst_rate / 100, 2);
    new.total_amount := round(new.subtotal + tax_total, 2);
  end if;
  new.gst_amount := tax_total;

  new.buyer_gstin := case when buyer.gstin_status = 'active' then buyer.gstin else null end;
  new.buyer_gstin_verified := buyer.gstin_status = 'active';
  new.seller_gstin := case when seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false) then seller.gstin else null end;
  new.seller_gstin_verified := seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false);
  new.tax_invoice_type := case when buyer.buyer_type = 'retail_store' and new.buyer_gstin_verified then 'b2b' else 'b2c' end;
  new.input_tax_credit_possible := new.tax_invoice_type = 'b2b' and new.seller_gstin_verified and tax_total > 0;

  buyer_state := coalesce(buyer.billing_address->>'state', buyer_user.state);
  seller_state := coalesce(seller.pickup_address->>'state', seller_user.state);
  new.place_of_supply_state := buyer_state;
  new.intra_state_supply := buyer_state is not null and seller_state is not null and lower(trim(buyer_state)) = lower(trim(seller_state));
  if new.intra_state_supply then
    new.cgst_amount := round(tax_total / 2, 2);
    new.sgst_amount := tax_total - new.cgst_amount;
    new.igst_amount := 0;
  else
    new.cgst_amount := 0;
    new.sgst_amount := 0;
    new.igst_amount := tax_total;
  end if;
  new.tax_note := case
    when new.input_tax_credit_possible then 'GST charged on the tax invoice. The registered buyer may claim eligible input tax credit subject to GST law and return matching.'
    when new.tax_invoice_type = 'b2b' then 'Buyer GSTIN recorded. Input tax credit depends on seller GST status, invoice validity and statutory conditions.'
    else 'Consumer invoice. GST, where applicable, remains payable and is not removed by entering a GSTIN.'
  end;
  return new;
end;
$$;

drop trigger if exists catalog_order_policy_and_tax on public.catalog_order_requests;
create trigger catalog_order_policy_and_tax
before insert or update of quantity, product_id, variant_id, buyer_id, company_id
on public.catalog_order_requests
for each row execute function public.enforce_catalog_order_policy_and_tax();

create or replace function public.submit_catalog_order_request(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_company_id uuid default null,
  p_company_location_id uuid default null,
  p_purchase_order_number text default null,
  p_payment_terms text default 'due_on_order',
  p_deposit_percent numeric default 0,
  p_requires_review boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  product_seller_id uuid;
  created public.catalog_order_requests%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select seller_id into product_seller_id from public.seller_products where id = p_product_id;
  if product_seller_id is null then raise exception 'Product not found'; end if;

  if p_company_id is not null and not exists (
    select 1 from public.b2b_company_accounts c where c.id = p_company_id and c.owner_user_id = current_user_id and c.is_active = true
  ) then
    raise exception 'Company account does not belong to this buyer' using errcode = '42501';
  end if;

  insert into public.catalog_order_requests (
    buyer_id, seller_id, product_id, variant_id, quantity, unit,
    price_per_unit, subtotal, gst_amount, total_amount, status,
    company_id, company_location_id, purchase_order_number,
    payment_terms, deposit_percent, requires_review, review_status, notes
  ) values (
    current_user_id, product_seller_id, p_product_id, p_variant_id, p_quantity, 'mtr',
    0, 0, 0, 0, 'pending', p_company_id, p_company_location_id,
    nullif(trim(p_purchase_order_number), ''), coalesce(nullif(trim(p_payment_terms), ''), 'due_on_order'),
    greatest(least(coalesce(p_deposit_percent, 0), 100), 0), coalesce(p_requires_review, false),
    case when coalesce(p_requires_review, false) then 'pending' else 'not_required' end,
    left(nullif(trim(p_notes), ''), 2000)
  ) returning * into created;

  return jsonb_build_object(
    'id', created.id,
    'orderRef', created.id,
    'buyerType', created.buyer_type,
    'quantity', created.quantity,
    'unit', created.unit,
    'pricePerUnit', created.price_per_unit,
    'subtotal', created.subtotal,
    'gstAmount', created.gst_amount,
    'totalAmount', created.total_amount,
    'invoiceType', created.tax_invoice_type,
    'inputTaxCreditPossible', created.input_tax_credit_possible,
    'taxNote', created.tax_note
  );
end;
$$;

revoke all on function public.submit_catalog_order_request(uuid, uuid, numeric, uuid, uuid, text, text, numeric, boolean, text) from public;
grant execute on function public.submit_catalog_order_request(uuid, uuid, numeric, uuid, uuid, text, text, numeric, boolean, text) to authenticated;
grant execute on function public.valid_gtin(text) to authenticated;
