-- Repair production projects where the early marketplace-state migrations were
-- not recorded/applied completely. All statements are idempotent so a clean
-- migration rebuild remains safe.

alter table public.user_profiles
  add column if not exists preferred_language text not null default 'en',
  add column if not exists preferred_theme text not null default 'system',
  add column if not exists notification_digest_time time not null default '08:00',
  add column if not exists notification_timezone text not null default 'Asia/Kolkata';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_preferred_language_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_preferred_language_check
      check (preferred_language in ('en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_preferred_theme_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_preferred_theme_check
      check (preferred_theme in ('light', 'dark', 'system'));
  end if;
end;
$$;

create table if not exists public.buyer_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null,
  product_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_key)
);

create index if not exists idx_buyer_wishlist_user
  on public.buyer_wishlist(user_id, created_at desc);
alter table public.buyer_wishlist enable row level security;

drop policy if exists "buyers_manage_own_wishlist" on public.buyer_wishlist;
create policy "buyers_manage_own_wishlist"
  on public.buyer_wishlist for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admins_read_wishlist" on public.buyer_wishlist;
create policy "admins_read_wishlist"
  on public.buyer_wishlist for select to authenticated
  using (public.is_admin());

drop trigger if exists buyer_wishlist_updated_at on public.buyer_wishlist;
create trigger buyer_wishlist_updated_at
  before update on public.buyer_wishlist
  for each row execute function public.set_updated_at();

create table if not exists public.seller_billing_documents (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  bulk_order_id uuid references public.bulk_orders(id) on delete set null,
  document_type text not null default 'invoice'
    check (document_type in ('invoice', 'eway_bill', 'packing_list', 'credit_note', 'other')),
  invoice_number text,
  amount numeric(12,2) check (amount is null or amount >= 0),
  file_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'verified', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seller_billing_seller
  on public.seller_billing_documents(seller_id, created_at desc);
create index if not exists idx_seller_billing_order
  on public.seller_billing_documents(bulk_order_id);
alter table public.seller_billing_documents enable row level security;

drop policy if exists "sellers_read_own_billing_documents" on public.seller_billing_documents;
create policy "sellers_read_own_billing_documents"
  on public.seller_billing_documents for select to authenticated
  using (seller_id = public.my_seller_id());

drop policy if exists "sellers_upload_own_billing_documents" on public.seller_billing_documents;
create policy "sellers_upload_own_billing_documents"
  on public.seller_billing_documents for insert to authenticated
  with check (seller_id = public.my_seller_id() and status = 'uploaded');

drop policy if exists "sellers_delete_unreviewed_billing_documents" on public.seller_billing_documents;
create policy "sellers_delete_unreviewed_billing_documents"
  on public.seller_billing_documents for delete to authenticated
  using (seller_id = public.my_seller_id() and status = 'uploaded');

drop policy if exists "admins_manage_billing_documents" on public.seller_billing_documents;
create policy "admins_manage_billing_documents"
  on public.seller_billing_documents for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists seller_billing_documents_updated_at on public.seller_billing_documents;
create trigger seller_billing_documents_updated_at
  before update on public.seller_billing_documents
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-billing',
  'seller-billing',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "seller_billing_owner_upload" on storage.objects;
create policy "seller_billing_owner_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'seller-billing'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_billing_owner_read" on storage.objects;
create policy "seller_billing_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'seller-billing'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "seller_billing_owner_delete" on storage.objects;
create policy "seller_billing_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'seller-billing'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create table if not exists public.discount_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 120),
  campaign_type text not null check (
    campaign_type in (
      'Website-wide', 'Product-specific', 'Category', 'Seller-specific',
      'Buyer-specific', 'First-order', 'Flash Sale', 'Coupon Code',
      'Festival Offer', 'Free Shipping'
    )
  ),
  target_product_key text,
  discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  min_order_value numeric(12,2) not null default 0 check (min_order_value >= 0),
  max_discount numeric(12,2) check (max_discount is null or max_discount >= 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  funded_by text not null default 'FabricTrad'
    check (funded_by in ('FabricTrad', 'Seller', 'Shared 50/50', 'Custom Split')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'active', 'paused', 'expired')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    campaign_type <> 'Product-specific'
    or nullif(trim(target_product_key), '') is not null
  )
);

create index if not exists idx_discount_campaigns_public
  on public.discount_campaigns(status, start_date, end_date);
alter table public.discount_campaigns enable row level security;

drop policy if exists "public_read_active_discount_campaigns" on public.discount_campaigns;
create policy "public_read_active_discount_campaigns"
  on public.discount_campaigns for select to anon, authenticated
  using (
    status = 'active'
    and current_date between start_date and end_date
    and (usage_limit is null or usage_count < usage_limit)
  );

drop policy if exists "admins_manage_discount_campaigns" on public.discount_campaigns;
create policy "admins_manage_discount_campaigns"
  on public.discount_campaigns for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists discount_campaigns_updated_at on public.discount_campaigns;
create trigger discount_campaigns_updated_at
  before update on public.discount_campaigns
  for each row execute function public.set_updated_at();

alter table public.bulk_orders
  add column if not exists discount_campaign_id uuid
    references public.discount_campaigns(id) on delete set null;

create or replace function public.record_discount_redemption(
  p_campaign_id uuid,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.bulk_orders bo
    where bo.id = p_order_id
      and bo.buyer_id = auth.uid()
      and bo.discount_campaign_id = p_campaign_id
  ) then
    raise exception 'Order does not belong to the current buyer or campaign';
  end if;

  update public.discount_campaigns
  set usage_count = usage_count + 1,
      updated_at = now()
  where id = p_campaign_id
    and status = 'active'
    and current_date between start_date and end_date
    and (usage_limit is null or usage_count < usage_limit);

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.record_discount_redemption(uuid, uuid) from public, anon;
grant execute on function public.record_discount_redemption(uuid, uuid) to authenticated;

create unique index if not exists idx_seller_registrations_user_id_unique
  on public.seller_registrations(user_id);
