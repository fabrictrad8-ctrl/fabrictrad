create table if not exists public.b2b_company_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  gstin text,
  status text not null default 'active' check (status in ('active','pending','suspended')),
  purchase_order_required boolean not null default false,
  order_review_required boolean not null default false,
  default_payment_terms text not null default 'due_on_order' check (default_payment_terms in ('due_on_order','due_on_fulfillment','net_7','net_15','net_30','net_45','net_60','net_90')),
  default_deposit_percent numeric(5,2) not null default 0 check (default_deposit_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2b_company_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.b2b_company_accounts(id) on delete cascade,
  location_name text not null,
  gstin text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  payment_terms text not null default 'inherit' check (payment_terms in ('inherit','due_on_order','due_on_fulfillment','net_7','net_15','net_30','net_45','net_60','net_90')),
  deposit_percent numeric(5,2) check (deposit_percent is null or deposit_percent between 0 and 100),
  order_review_required boolean,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists b2b_company_locations_one_default
  on public.b2b_company_locations(company_id)
  where is_default;

create table if not exists public.b2b_company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.b2b_company_accounts(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'ordering' check (role in ('company_admin','ordering','viewer')),
  can_place_orders boolean not null default true,
  can_view_all_orders boolean not null default false,
  invite_status text not null default 'pending' check (invite_status in ('pending','active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, email)
);

create table if not exists public.seller_catalogs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  scope text not null default 'all_buyers' check (scope in ('all_buyers','company')),
  company_id uuid references public.b2b_company_accounts(id) on delete set null,
  currency text not null default 'INR',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'all_buyers' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.seller_catalog_rules (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.seller_catalogs(id) on delete cascade,
  product_id uuid not null references public.seller_products(id) on delete cascade,
  variant_id uuid references public.seller_product_variants(id) on delete cascade,
  price_override numeric(12,2) check (price_override is null or price_override > 0),
  minimum_quantity numeric(12,2) not null default 1 check (minimum_quantity > 0),
  maximum_quantity numeric(12,2) check (maximum_quantity is null or maximum_quantity >= minimum_quantity),
  quantity_increment numeric(12,2) not null default 1 check (quantity_increment > 0),
  price_breaks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(catalog_id, product_id, variant_id)
);

create table if not exists public.buyer_reorder_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_order_requests
  add column if not exists company_id uuid references public.b2b_company_accounts(id) on delete set null,
  add column if not exists company_location_id uuid references public.b2b_company_locations(id) on delete set null,
  add column if not exists purchase_order_number text,
  add column if not exists payment_terms text not null default 'due_on_order',
  add column if not exists deposit_percent numeric(5,2) not null default 0,
  add column if not exists requires_review boolean not null default false,
  add column if not exists review_status text not null default 'not_required';

alter table public.orders
  add column if not exists company_id uuid references public.b2b_company_accounts(id) on delete set null,
  add column if not exists company_location_id uuid references public.b2b_company_locations(id) on delete set null,
  add column if not exists purchase_order_number text,
  add column if not exists payment_terms text not null default 'due_on_order',
  add column if not exists deposit_percent numeric(5,2) not null default 0,
  add column if not exists requires_review boolean not null default false,
  add column if not exists review_status text not null default 'not_required';

create index if not exists b2b_company_locations_company_idx on public.b2b_company_locations(company_id);
create index if not exists b2b_company_contacts_company_idx on public.b2b_company_contacts(company_id);
create index if not exists seller_catalogs_seller_status_idx on public.seller_catalogs(seller_id, status);
create index if not exists seller_catalogs_company_idx on public.seller_catalogs(company_id) where company_id is not null;
create index if not exists seller_catalog_rules_catalog_idx on public.seller_catalog_rules(catalog_id);
create index if not exists seller_catalog_rules_product_variant_idx on public.seller_catalog_rules(product_id, variant_id);
create index if not exists buyer_reorder_lists_user_idx on public.buyer_reorder_lists(user_id, updated_at desc);
create index if not exists catalog_order_requests_company_idx on public.catalog_order_requests(company_id, company_location_id);
create index if not exists orders_company_idx on public.orders(company_id, company_location_id);

alter table public.b2b_company_accounts enable row level security;
alter table public.b2b_company_locations enable row level security;
alter table public.b2b_company_contacts enable row level security;
alter table public.seller_catalogs enable row level security;
alter table public.seller_catalog_rules enable row level security;
alter table public.buyer_reorder_lists enable row level security;

drop policy if exists b2b_company_owner_access on public.b2b_company_accounts;
create policy b2b_company_owner_access on public.b2b_company_accounts for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
drop policy if exists b2b_company_admin_access on public.b2b_company_accounts;
create policy b2b_company_admin_access on public.b2b_company_accounts for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists b2b_location_owner_access on public.b2b_company_locations;
create policy b2b_location_owner_access on public.b2b_company_locations for all to authenticated
using (exists (select 1 from public.b2b_company_accounts c where c.id = company_id and c.owner_user_id = auth.uid()))
with check (exists (select 1 from public.b2b_company_accounts c where c.id = company_id and c.owner_user_id = auth.uid()));
drop policy if exists b2b_location_admin_access on public.b2b_company_locations;
create policy b2b_location_admin_access on public.b2b_company_locations for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists b2b_contact_owner_access on public.b2b_company_contacts;
create policy b2b_contact_owner_access on public.b2b_company_contacts for all to authenticated
using (exists (select 1 from public.b2b_company_accounts c where c.id = company_id and c.owner_user_id = auth.uid()))
with check (exists (select 1 from public.b2b_company_accounts c where c.id = company_id and c.owner_user_id = auth.uid()));
drop policy if exists b2b_contact_admin_access on public.b2b_company_contacts;
create policy b2b_contact_admin_access on public.b2b_company_contacts for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists seller_catalog_owner_access on public.seller_catalogs;
create policy seller_catalog_owner_access on public.seller_catalogs for all to authenticated
using (seller_id = my_seller_id() and can_current_user_sell())
with check (seller_id = my_seller_id() and can_current_user_sell());
drop policy if exists seller_catalog_admin_access on public.seller_catalogs;
create policy seller_catalog_admin_access on public.seller_catalogs for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists seller_catalog_buyer_read on public.seller_catalogs;
create policy seller_catalog_buyer_read on public.seller_catalogs for select to authenticated using (
  status = 'active' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
  and (scope = 'all_buyers' or exists (select 1 from public.b2b_company_accounts c where c.id = company_id and c.owner_user_id = auth.uid()))
);

drop policy if exists seller_catalog_rule_owner_access on public.seller_catalog_rules;
create policy seller_catalog_rule_owner_access on public.seller_catalog_rules for all to authenticated
using (exists (select 1 from public.seller_catalogs c where c.id = catalog_id and c.seller_id = my_seller_id() and can_current_user_sell()))
with check (exists (select 1 from public.seller_catalogs c where c.id = catalog_id and c.seller_id = my_seller_id() and can_current_user_sell()));
drop policy if exists seller_catalog_rule_admin_access on public.seller_catalog_rules;
create policy seller_catalog_rule_admin_access on public.seller_catalog_rules for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists seller_catalog_rule_buyer_read on public.seller_catalog_rules;
create policy seller_catalog_rule_buyer_read on public.seller_catalog_rules for select to authenticated using (exists (
  select 1 from public.seller_catalogs c where c.id = catalog_id and c.status = 'active'
    and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at >= now())
    and (c.scope = 'all_buyers' or exists (select 1 from public.b2b_company_accounts b where b.id = c.company_id and b.owner_user_id = auth.uid()))
));

drop policy if exists buyer_reorder_owner_access on public.buyer_reorder_lists;
create policy buyer_reorder_owner_access on public.buyer_reorder_lists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists buyer_reorder_admin_access on public.buyer_reorder_lists;
create policy buyer_reorder_admin_access on public.buyer_reorder_lists for all to authenticated using (is_admin()) with check (is_admin());

grant select, insert, update, delete on public.b2b_company_accounts to authenticated;
grant select, insert, update, delete on public.b2b_company_locations to authenticated;
grant select, insert, update, delete on public.b2b_company_contacts to authenticated;
grant select, insert, update, delete on public.seller_catalogs to authenticated;
grant select, insert, update, delete on public.seller_catalog_rules to authenticated;
grant select, insert, update, delete on public.buyer_reorder_lists to authenticated;