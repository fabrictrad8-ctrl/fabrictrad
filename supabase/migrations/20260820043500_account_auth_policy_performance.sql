-- Keep the account bootstrap path fast as the profile tables grow.
-- Wrapping auth.uid() in SELECT lets Postgres evaluate it once per statement
-- instead of once per candidate row. The user_profiles ALL policy already
-- covered read/update, so remove the redundant overlapping policies.

begin;

alter table public.user_profiles enable row level security;
drop policy if exists users_manage_own_profile on public.user_profiles;
drop policy if exists users_read_own_profile on public.user_profiles;
drop policy if exists users_update_own_profile on public.user_profiles;
create policy users_manage_own_profile
on public.user_profiles
for all
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter table public.buyer_profiles enable row level security;
drop policy if exists buyer_manage_own_buyer_profile on public.buyer_profiles;
create policy buyer_manage_own_buyer_profile
on public.buyer_profiles
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter table public.seller_profiles enable row level security;
drop policy if exists seller_manage_own_seller_profile on public.seller_profiles;
create policy seller_manage_own_seller_profile
on public.seller_profiles
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;
