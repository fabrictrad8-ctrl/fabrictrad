alter table public.buyer_profiles
  add column if not exists buyer_type text not null default 'end_user';

update public.buyer_profiles
set buyer_type = case
  when coalesce(nullif(trim(gstin), ''), nullif(trim(business_name), '')) is not null then 'retail_store'
  else 'end_user'
end
where buyer_type is null or buyer_type not in ('retail_store', 'end_user');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'buyer_profiles_buyer_type_check'
      and conrelid = 'public.buyer_profiles'::regclass
  ) then
    alter table public.buyer_profiles
      add constraint buyer_profiles_buyer_type_check
      check (buyer_type in ('retail_store', 'end_user'));
  end if;
end $$;

alter table public.seller_profiles
  add column if not exists supply_tier text not null default 'micro_stockist',
  add column if not exists inventory_capacity_metres numeric(14,2),
  add column if not exists direct_mill_source boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seller_profiles_supply_tier_check'
      and conrelid = 'public.seller_profiles'::regclass
  ) then
    alter table public.seller_profiles
      add constraint seller_profiles_supply_tier_check
      check (supply_tier in ('micro_stockist', 'small_stockist', 'medium_stockist', 'wholesaler', 'mill'));
  end if;
end $$;

create table if not exists public.supply_chain_links (
  id uuid primary key default gen_random_uuid(),
  downstream_variant_id uuid not null references public.seller_product_variants(id) on delete cascade,
  upstream_variant_id uuid not null references public.seller_product_variants(id) on delete cascade,
  min_order_quantity numeric(14,2) not null default 0,
  max_order_quantity numeric(14,2),
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_chain_links_distinct_variants check (downstream_variant_id <> upstream_variant_id),
  constraint supply_chain_links_quantity_range check (
    min_order_quantity >= 0 and
    (max_order_quantity is null or max_order_quantity >= min_order_quantity)
  ),
  unique (downstream_variant_id, upstream_variant_id)
);

create index if not exists supply_chain_links_downstream_idx
  on public.supply_chain_links (downstream_variant_id, active, priority);
create index if not exists supply_chain_links_upstream_idx
  on public.supply_chain_links (upstream_variant_id);

alter table public.catalog_order_requests
  add column if not exists buyer_type text not null default 'end_user',
  add column if not exists fulfillment_variant_id uuid references public.seller_product_variants(id) on delete set null,
  add column if not exists fulfillment_depth integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_order_requests_buyer_type_check'
      and conrelid = 'public.catalog_order_requests'::regclass
  ) then
    alter table public.catalog_order_requests
      add constraint catalog_order_requests_buyer_type_check
      check (buyer_type in ('retail_store', 'end_user'));
  end if;
end $$;

alter table public.supply_chain_links enable row level security;

drop policy if exists "Authenticated users can view supply links" on public.supply_chain_links;
create policy "Authenticated users can view supply links"
on public.supply_chain_links for select
to authenticated
using (true);

drop policy if exists "Sellers can manage their downstream supply links" on public.supply_chain_links;
create policy "Sellers can manage their downstream supply links"
on public.supply_chain_links for all
to authenticated
using (
  exists (
    select 1
    from public.seller_product_variants variant
    join public.seller_profiles seller on seller.id = variant.seller_id
    where variant.id = downstream_variant_id
      and seller.user_id = auth.uid()
  )
  or exists (
    select 1 from public.user_profiles profile
    where profile.id = auth.uid()
      and profile.role in ('admin_staff', 'super_admin')
      and profile.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.seller_product_variants variant
    join public.seller_profiles seller on seller.id = variant.seller_id
    where variant.id = downstream_variant_id
      and seller.user_id = auth.uid()
  )
  or exists (
    select 1 from public.user_profiles profile
    where profile.id = auth.uid()
      and profile.role in ('admin_staff', 'super_admin')
      and profile.is_active = true
  )
);

create or replace function public.resolve_catalog_fulfillment(
  p_variant_id uuid,
  p_quantity numeric
)
returns table (
  variant_id uuid,
  seller_id uuid,
  fulfillment_depth integer,
  available_quantity numeric,
  reserved_quantity numeric,
  available_to_sell numeric,
  price_per_unit numeric,
  unit text,
  color_name text,
  design_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive candidates as (
    select
      variant.id as variant_id,
      variant.seller_id,
      0 as depth,
      0 as edge_priority,
      array[variant.id]::uuid[] as visited
    from public.seller_product_variants variant
    where variant.id = p_variant_id

    union all

    select
      upstream.id,
      upstream.seller_id,
      candidates.depth + 1,
      link.priority,
      candidates.visited || upstream.id
    from candidates
    join public.supply_chain_links link
      on link.downstream_variant_id = candidates.variant_id
     and link.active = true
     and p_quantity >= link.min_order_quantity
     and (link.max_order_quantity is null or p_quantity <= link.max_order_quantity)
    join public.seller_product_variants upstream
      on upstream.id = link.upstream_variant_id
    where candidates.depth < 8
      and not upstream.id = any(candidates.visited)
  )
  select
    variant.id,
    variant.seller_id,
    candidates.depth,
    variant.available_quantity,
    variant.reserved_quantity,
    greatest(variant.available_quantity - variant.reserved_quantity, 0),
    variant.price_per_unit,
    variant.unit,
    variant.color_name,
    variant.design_name
  from candidates
  join public.seller_product_variants variant on variant.id = candidates.variant_id
  where variant.status = 'active'
    and variant.approval_status = 'approved'
    and variant.moq <= p_quantity
    and greatest(variant.available_quantity - variant.reserved_quantity, 0) >= p_quantity
  order by candidates.depth asc, candidates.edge_priority asc, variant.price_per_unit asc
  limit 1;
$$;

grant select on public.supply_chain_links to authenticated;
grant insert, update, delete on public.supply_chain_links to authenticated;
grant execute on function public.resolve_catalog_fulfillment(uuid, numeric) to authenticated;
