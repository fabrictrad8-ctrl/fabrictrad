create table if not exists public.shopify_product_links (
  seller_product_id uuid primary key references public.seller_products(id) on delete cascade,
  shopify_product_gid text not null unique,
  shopify_variant_gid text,
  shopify_inventory_item_gid text,
  shopify_location_gid text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending','error','archived')),
  last_synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.shopify_customer_links (
  supabase_user_id uuid primary key references auth.users(id) on delete cascade,
  shopify_customer_gid text unique,
  email text,
  last_synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.shopify_order_links (
  shopify_order_gid text primary key,
  catalog_order_id uuid references public.catalog_order_requests(id) on delete set null,
  supabase_user_id uuid references auth.users(id) on delete set null,
  shopify_order_name text,
  financial_status text,
  fulfillment_status text,
  last_synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.shopify_webhook_events (
  shopify_webhook_id text primary key,
  topic text not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

alter table public.shopify_product_links enable row level security;
alter table public.shopify_customer_links enable row level security;
alter table public.shopify_order_links enable row level security;
alter table public.shopify_webhook_events enable row level security;

comment on table public.shopify_product_links is 'Server-side FabricTrad to Shopify catalogue identity map. No public RLS policy by design.';
comment on table public.shopify_customer_links is 'Server-side Supabase user to Shopify customer identity map. No public RLS policy by design.';
comment on table public.shopify_order_links is 'Server-side Shopify to FabricTrad order reconciliation map. No public RLS policy by design.';
comment on table public.shopify_webhook_events is 'Idempotency/audit store for verified Shopify webhooks. No public RLS policy by design.';

create index if not exists shopify_product_links_variant_idx on public.shopify_product_links(shopify_variant_gid);
create index if not exists shopify_customer_links_email_idx on public.shopify_customer_links(lower(email));
create index if not exists shopify_order_links_user_idx on public.shopify_order_links(supabase_user_id);
