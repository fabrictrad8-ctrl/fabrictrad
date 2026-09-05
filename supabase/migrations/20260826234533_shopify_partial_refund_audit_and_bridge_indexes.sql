create table if not exists public.shopify_refund_operations (
  id uuid primary key default gen_random_uuid(),
  operational_order_id uuid not null references public.orders(id) on delete restrict,
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  shopify_order_gid text not null,
  shopify_refund_gid text,
  operation_type text not null default 'seller_rejection_partial_refund' check (operation_type in ('seller_rejection_partial_refund','full_order_cancel_refund','return_refund')),
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed','manual_review')),
  requested_line_items jsonb not null default '[]'::jsonb,
  shopify_response jsonb not null default '{}'::jsonb,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint shopify_refund_operations_unique_seller_order unique (operational_order_id, operation_type)
);

alter table public.shopify_refund_operations enable row level security;
revoke all on table public.shopify_refund_operations from anon, authenticated;
grant all on table public.shopify_refund_operations to service_role;

create index if not exists shopify_refund_operations_shopify_order_idx on public.shopify_refund_operations(shopify_order_gid);
create index if not exists shopify_refund_operations_seller_idx on public.shopify_refund_operations(seller_id, created_at desc);
create index if not exists shopify_order_links_catalog_order_id_idx on public.shopify_order_links(catalog_order_id) where catalog_order_id is not null;
