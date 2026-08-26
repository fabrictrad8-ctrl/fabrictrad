-- India GST / HSN hardening for FabricTrad.
-- Notification No. 9/2025-Integrated Tax (Rate), effective 22 September 2025:
-- apparel/made-ups under Chapters 61-63 use a Rs 2,500 per-piece threshold.

create or replace function public.resolve_india_gst_rate(
  p_hsn text,
  p_unit_price numeric,
  p_fallback numeric default 0
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  h text := regexp_replace(coalesce(p_hsn, ''), '[^0-9]', '', 'g');
  price numeric := coalesce(p_unit_price, 0);
begin
  if h = '' then
    return greatest(coalesce(p_fallback, 0), 0);
  end if;

  if left(h, 2) in ('61', '62') then
    return case when price <= 2500 then 5 else 18 end;
  end if;

  if left(h, 4) in ('6309', '6310') then
    return 5;
  end if;
  if left(h, 8) in ('63053200', '63053300') then
    return 18;
  end if;
  if left(h, 2) = '63' then
    return case when price <= 2500 then 5 else 18 end;
  end if;

  if left(h, 2) = '60' then
    return 5;
  end if;

  return greatest(coalesce(p_fallback, 0), 0);
end;
$$;

alter table public.seller_products
  drop constraint if exists seller_products_hsn_code_format_check;

alter table public.seller_products
  add constraint seller_products_hsn_code_format_check
  check (
    hsn_code is null
    or hsn_code ~ '^[0-9]{4}([0-9]{2})?([0-9]{2})?$'
  );

create or replace function public.sync_seller_product_tax_classification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
begin
  h := regexp_replace(coalesce(new.hsn_code, ''), '[^0-9]', '', 'g');
  if h = '' then
    new.hsn_code := null;
  else
    if length(h) not in (4, 6, 8) then
      raise exception 'HSN must contain 4, 6 or 8 digits';
    end if;
    new.hsn_code := h;
  end if;

  new.gst_rate := public.resolve_india_gst_rate(
    new.hsn_code,
    new.price_per_unit,
    coalesce(new.gst_rate, 0)
  );
  return new;
end;
$$;

drop trigger if exists aaa_seller_products_sync_tax on public.seller_products;
create trigger aaa_seller_products_sync_tax
before insert or update of hsn_code, price_per_unit, gst_rate
on public.seller_products
for each row execute function public.sync_seller_product_tax_classification();

create or replace function public.sync_seller_variant_tax_classification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_hsn text;
  parent_rate numeric;
begin
  select p.hsn_code, p.gst_rate
    into parent_hsn, parent_rate
  from public.seller_products p
  where p.id = new.product_id;

  new.gst_rate := public.resolve_india_gst_rate(
    parent_hsn,
    new.price_per_unit,
    coalesce(new.gst_rate, parent_rate, 0)
  );
  return new;
end;
$$;

drop trigger if exists aaa_seller_variants_sync_tax on public.seller_product_variants;
create trigger aaa_seller_variants_sync_tax
before insert or update of product_id, price_per_unit, gst_rate
on public.seller_product_variants
for each row execute function public.sync_seller_variant_tax_classification();

create or replace function public.apply_catalog_order_india_gst()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_rate numeric;
  tax_total numeric;
begin
  resolved_rate := public.resolve_india_gst_rate(
    new.hsn_code,
    new.price_per_unit,
    coalesce(new.gst_rate, 0)
  );
  new.gst_rate := resolved_rate;

  if coalesce(new.price_includes_gst, false) and resolved_rate > 0 then
    tax_total := round(new.subtotal - (new.subtotal / (1 + resolved_rate / 100)), 2);
    new.total_amount := new.subtotal;
  else
    tax_total := round(new.subtotal * resolved_rate / 100, 2);
    new.total_amount := round(new.subtotal + tax_total, 2);
  end if;

  new.gst_amount := tax_total;
  if coalesce(new.intra_state_supply, false) then
    new.cgst_amount := round(tax_total / 2, 2);
    new.sgst_amount := tax_total - new.cgst_amount;
    new.igst_amount := 0;
  else
    new.cgst_amount := 0;
    new.sgst_amount := 0;
    new.igst_amount := tax_total;
  end if;
  new.input_tax_credit_possible :=
    new.tax_invoice_type = 'b2b'
    and coalesce(new.seller_gstin_verified, false)
    and tax_total > 0;
  return new;
end;
$$;

drop trigger if exists zz_catalog_order_india_gst on public.catalog_order_requests;
create trigger zz_catalog_order_india_gst
before insert or update
on public.catalog_order_requests
for each row execute function public.apply_catalog_order_india_gst();

create or replace function public.require_verified_gstin_for_live_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller public.seller_profiles%rowtype;
  listing_hsn text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select * into seller from public.seller_profiles where id = new.seller_id;
  if not found then
    raise exception 'Seller profile not found';
  end if;
  if not (seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false)) then
    raise exception 'An active verified GSTIN is required before a listing can be published. Save it as a draft while verification is pending.';
  end if;

  if tg_table_name = 'seller_products' then
    listing_hsn := regexp_replace(coalesce(new.hsn_code, ''), '[^0-9]', '', 'g');
  else
    select regexp_replace(coalesce(p.hsn_code, ''), '[^0-9]', '', 'g')
      into listing_hsn
    from public.seller_products p
    where p.id = new.product_id;
  end if;

  if coalesce(listing_hsn, '') = '' or length(listing_hsn) not in (4, 6, 8) then
    raise exception 'A valid 4, 6 or 8 digit HSN classification is required before a listing can be published.';
  end if;

  return new;
end;
$$;
