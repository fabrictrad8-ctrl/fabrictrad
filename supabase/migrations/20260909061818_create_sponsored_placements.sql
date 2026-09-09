-- Reconstructed from the applied live migration 20260909061818_create_sponsored_placements.
-- Sponsored listings ("Amazon-style" paid placement in the marketplace grid).
-- No automated seller billing exists anywhere in this app yet (payouts,
-- discount campaigns, etc. are all admin-recorded/manual arrangements), so
-- this follows the same pattern as discount_campaigns: FabricTrad staff
-- create/manage placements here, funded_by/daily_rate/notes are for the
-- admin's own bookkeeping (e.g. "seller paid via bank transfer, ref #123"),
-- not an automated charge. Building a real seller self-serve bidding/billing
-- system is a separate, larger product decision than placement itself.
create table public.sponsored_placements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.seller_products(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'active' check (status in ('active', 'paused')),
  funded_by text not null default 'Seller' check (funded_by in ('Seller', 'FabricTrad', 'Shared 50/50', 'Custom Split')),
  daily_rate numeric check (daily_rate is null or daily_rate >= 0),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sponsored_placements_product_id_idx on public.sponsored_placements (product_id);
create index sponsored_placements_active_dates_idx on public.sponsored_placements (status, start_date, end_date);

create trigger sponsored_placements_updated_at
  before update on public.sponsored_placements
  for each row execute function public.set_updated_at();

alter table public.sponsored_placements enable row level security;

-- Which products are sponsored is advertised, not private - anyone (including
-- anon marketplace visitors) can read active placements so the storefront can
-- render the "Sponsored" badge without needing an authenticated round trip.
create policy sponsored_placements_public_select on public.sponsored_placements
  for select using (true);

create policy sponsored_placements_admin_all on public.sponsored_placements
  for all using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = any (array['super_admin'::public.user_role, 'admin_staff'::public.user_role])
    )
  );
