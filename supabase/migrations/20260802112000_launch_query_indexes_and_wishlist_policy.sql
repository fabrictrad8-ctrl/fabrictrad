-- Targeted pre-launch performance repairs identified by the Supabase advisor.
-- Keep this migration narrow: add covering indexes for active foreign keys and
-- avoid per-row auth.uid() evaluation or overlapping SELECT policies on wishlist.

create index if not exists bulk_orders_discount_campaign_idx
  on public.bulk_orders(discount_campaign_id);

create index if not exists business_kyc_documents_reviewed_by_idx
  on public.business_kyc_documents(reviewed_by);

create index if not exists catalog_order_requests_fulfillment_variant_idx
  on public.catalog_order_requests(fulfillment_variant_id);

create index if not exists discount_campaigns_created_by_idx
  on public.discount_campaigns(created_by);

drop policy if exists "buyers_manage_own_wishlist" on public.buyer_wishlist;
drop policy if exists "admins_read_wishlist" on public.buyer_wishlist;
drop policy if exists "buyer_wishlist_select" on public.buyer_wishlist;
drop policy if exists "buyer_wishlist_insert" on public.buyer_wishlist;
drop policy if exists "buyer_wishlist_update" on public.buyer_wishlist;
drop policy if exists "buyer_wishlist_delete" on public.buyer_wishlist;

create policy "buyer_wishlist_select"
  on public.buyer_wishlist
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
  );

create policy "buyer_wishlist_insert"
  on public.buyer_wishlist
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "buyer_wishlist_update"
  on public.buyer_wishlist
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "buyer_wishlist_delete"
  on public.buyer_wishlist
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
