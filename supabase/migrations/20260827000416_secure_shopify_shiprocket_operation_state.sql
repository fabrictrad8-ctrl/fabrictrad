alter table public.seller_shipments add column if not exists operational_order_id uuid references public.orders(id) on delete restrict;
alter table public.seller_shipments add column if not exists shopify_fulfillment_gid text;
alter table public.seller_shipments add column if not exists shiprocket_order_id text;
alter table public.seller_shipments add column if not exists shiprocket_shipment_id text;
create unique index if not exists seller_shipments_operational_order_uniq on public.seller_shipments(operational_order_id) where operational_order_id is not null;
create index if not exists seller_shipments_shopify_fulfillment_idx on public.seller_shipments(shopify_fulfillment_gid) where shopify_fulfillment_gid is not null;

drop policy if exists seller_shipments_seller_manage on public.seller_shipments;
drop policy if exists seller_shipments_seller_read on public.seller_shipments;
create policy seller_shipments_seller_read on public.seller_shipments for select to authenticated using ((seller_id=public.my_seller_id()) and public.can_current_user_sell());

create table if not exists public.shiprocket_shipment_operations (
  id uuid primary key default gen_random_uuid(),
  operational_order_id uuid not null references public.orders(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','shiprocket_created','succeeded','failed','manual_review')),
  requested_package jsonb not null default '{}'::jsonb,
  mapped_fulfillment_items jsonb not null default '[]'::jsonb,
  shiprocket_order_id text,
  shiprocket_shipment_id text,
  awb_code text,
  shopify_fulfillment_gid text,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint shiprocket_shipment_operations_one_per_order unique (operational_order_id)
);
alter table public.shiprocket_shipment_operations enable row level security;
revoke all on table public.shiprocket_shipment_operations from anon,authenticated;
grant all on table public.shiprocket_shipment_operations to service_role;
create index if not exists shiprocket_shipment_operations_seller_idx on public.shiprocket_shipment_operations(seller_id,created_at desc);
create index if not exists shiprocket_shipment_operations_status_idx on public.shiprocket_shipment_operations(status,updated_at);
