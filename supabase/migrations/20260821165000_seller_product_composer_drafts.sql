create table if not exists public.seller_product_drafts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  draft_key text not null,
  payload jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_product_drafts_draft_key_check
    check (char_length(trim(draft_key)) between 1 and 160),
  constraint seller_product_drafts_seller_key_unique unique (seller_id, draft_key)
);

alter table public.seller_product_drafts enable row level security;
revoke all on table public.seller_product_drafts from anon;
grant select, insert, update, delete on table public.seller_product_drafts to authenticated;

drop policy if exists seller_product_drafts_owner_select on public.seller_product_drafts;
create policy seller_product_drafts_owner_select
on public.seller_product_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = seller_product_drafts.seller_id
      and sp.user_id = (select auth.uid())
  )
);

drop policy if exists seller_product_drafts_owner_insert on public.seller_product_drafts;
create policy seller_product_drafts_owner_insert
on public.seller_product_drafts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = seller_product_drafts.seller_id
      and sp.user_id = (select auth.uid())
  )
);

drop policy if exists seller_product_drafts_owner_update on public.seller_product_drafts;
create policy seller_product_drafts_owner_update
on public.seller_product_drafts
for update
to authenticated
using (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = seller_product_drafts.seller_id
      and sp.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = seller_product_drafts.seller_id
      and sp.user_id = (select auth.uid())
  )
);

drop policy if exists seller_product_drafts_owner_delete on public.seller_product_drafts;
create policy seller_product_drafts_owner_delete
on public.seller_product_drafts
for delete
to authenticated
using (
  exists (
    select 1
    from public.seller_profiles sp
    where sp.id = seller_product_drafts.seller_id
      and sp.user_id = (select auth.uid())
  )
);

create index if not exists seller_product_drafts_seller_updated_idx
  on public.seller_product_drafts (seller_id, updated_at desc);

drop trigger if exists trg_seller_product_drafts_updated_at on public.seller_product_drafts;
create trigger trg_seller_product_drafts_updated_at
before update on public.seller_product_drafts
for each row execute function public.set_updated_at();
