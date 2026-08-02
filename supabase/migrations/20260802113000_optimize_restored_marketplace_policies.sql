-- Consolidate policies on the marketplace tables restored immediately before
-- launch. This preserves the same permissions while avoiding duplicate policy
-- evaluation for authenticated requests.

-- Discount campaigns: everyone may read currently active offers; admins may
-- also read inactive/scheduled offers and remain the only writers.
drop policy if exists "public_read_active_discount_campaigns" on public.discount_campaigns;
drop policy if exists "admins_manage_discount_campaigns" on public.discount_campaigns;
drop policy if exists "discount_campaigns_read" on public.discount_campaigns;
drop policy if exists "discount_campaigns_admin_insert" on public.discount_campaigns;
drop policy if exists "discount_campaigns_admin_update" on public.discount_campaigns;
drop policy if exists "discount_campaigns_admin_delete" on public.discount_campaigns;

create policy "discount_campaigns_read"
  on public.discount_campaigns
  for select
  to anon, authenticated
  using (
    (
      status = 'active'
      and current_date between start_date and end_date
      and (usage_limit is null or usage_count < usage_limit)
    )
    or public.is_admin()
  );

create policy "discount_campaigns_admin_insert"
  on public.discount_campaigns
  for insert
  to authenticated
  with check (public.is_admin());

create policy "discount_campaigns_admin_update"
  on public.discount_campaigns
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "discount_campaigns_admin_delete"
  on public.discount_campaigns
  for delete
  to authenticated
  using (public.is_admin());

-- Billing documents: sellers manage only their own unreviewed uploads; admins
-- can review/read/delete any document. A single policy exists per operation.
drop policy if exists "sellers_read_own_billing_documents" on public.seller_billing_documents;
drop policy if exists "sellers_upload_own_billing_documents" on public.seller_billing_documents;
drop policy if exists "sellers_delete_unreviewed_billing_documents" on public.seller_billing_documents;
drop policy if exists "admins_manage_billing_documents" on public.seller_billing_documents;
drop policy if exists "seller_billing_documents_select" on public.seller_billing_documents;
drop policy if exists "seller_billing_documents_insert" on public.seller_billing_documents;
drop policy if exists "seller_billing_documents_update" on public.seller_billing_documents;
drop policy if exists "seller_billing_documents_delete" on public.seller_billing_documents;

create policy "seller_billing_documents_select"
  on public.seller_billing_documents
  for select
  to authenticated
  using (
    seller_id = public.my_seller_id()
    or public.is_admin()
  );

create policy "seller_billing_documents_insert"
  on public.seller_billing_documents
  for insert
  to authenticated
  with check (
    (seller_id = public.my_seller_id() and status = 'uploaded')
    or public.is_admin()
  );

create policy "seller_billing_documents_update"
  on public.seller_billing_documents
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "seller_billing_documents_delete"
  on public.seller_billing_documents
  for delete
  to authenticated
  using (
    (seller_id = public.my_seller_id() and status = 'uploaded')
    or public.is_admin()
  );
