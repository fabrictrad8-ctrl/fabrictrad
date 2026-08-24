alter table public.seller_shipments
  add column if not exists shiprocket_courier_id text,
  add column if not exists pickup_location_name text,
  add column if not exists shipping_cost numeric(12,2),
  add column if not exists label_url text,
  add column if not exists manifest_url text,
  add column if not exists pickup_scheduled boolean not null default false,
  add column if not exists serviceability_snapshot jsonb;
