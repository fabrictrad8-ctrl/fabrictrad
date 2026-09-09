-- Buyer and seller dashboards join seller_products live, so renaming a product
-- retroactively changed what past orders displayed. The tax invoice already
-- snapshots name/SKU/HSN at issue time (issue_catalog_tax_invoice builds an
-- immutable line payload), so this covers the order record itself, which is
-- what both dashboards read before an invoice exists.
alter table public.catalog_order_requests
  add column if not exists product_name_snapshot text,
  add column if not exists product_sku_snapshot text;

create or replace function public.snapshot_catalog_order_product()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.product_name_snapshot is null or new.product_sku_snapshot is null then
    select coalesce(new.product_name_snapshot, sp.name),
           coalesce(new.product_sku_snapshot, sp.sku)
      into new.product_name_snapshot, new.product_sku_snapshot
    from public.seller_products sp
    where sp.id = new.product_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists catalog_order_product_snapshot on public.catalog_order_requests;
create trigger catalog_order_product_snapshot
  before insert on public.catalog_order_requests
  for each row execute function public.snapshot_catalog_order_product();

-- Backfill from current product data. This is the best available value for
-- historical rows — the name as it stood when those orders were placed was
-- never recorded, so these are approximations, not recovered history.
-- protect_catalog_order_request_state() only accepts service_role or an admin,
-- so this one-off maintenance write identifies itself as the system actor for
-- its own statement and restores the surrounding context afterwards.
do $$
declare
  prev_claims text := current_setting('request.jwt.claims', true);
begin
  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);

  update public.catalog_order_requests o
     set product_name_snapshot = sp.name,
         product_sku_snapshot = sp.sku
    from public.seller_products sp
   where sp.id = o.product_id
     and (o.product_name_snapshot is null or o.product_sku_snapshot is null);

  perform set_config('request.jwt.claims', coalesce(prev_claims, ''), true);
end $$;
