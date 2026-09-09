-- Reconstructed from the applied live migration 20260909063611_seller_self_serve_discount_campaigns.
-- Sellers can create their own discount/coupon campaigns scoped to their
-- own shop or their own products (admin retains system-wide + all other
-- campaign types). Additive to the existing admin-only policies - RLS
-- policies for the same command combine with OR, so this only ever adds
-- permission, never removes the admin path.
create policy discount_campaigns_seller_insert on public.discount_campaigns
for insert
with check (
  public.can_current_user_sell()
  and created_by = auth.uid()
  and funded_by = 'Seller'
  and campaign_type in ('Product-specific', 'Seller-specific', 'Coupon Code')
  and (
    (campaign_type = 'Seller-specific' and target_product_key = public.my_seller_id()::text)
    or (campaign_type = 'Product-specific' and exists (
      select 1 from public.seller_products sp
      where sp.id::text = target_product_key and sp.seller_id = public.my_seller_id()
    ))
    or (campaign_type = 'Coupon Code' and target_product_key = public.my_seller_id()::text)
  )
);

create policy discount_campaigns_seller_update on public.discount_campaigns
for update
using (created_by = auth.uid() and public.can_current_user_sell())
with check (created_by = auth.uid() and public.can_current_user_sell() and funded_by = 'Seller');

create policy discount_campaigns_seller_delete on public.discount_campaigns
for delete
using (created_by = auth.uid() and public.can_current_user_sell());

-- Let a seller see their own campaigns even outside the public "currently
-- eligible" window (e.g. a scheduled-for-later or paused campaign they made).
create policy discount_campaigns_seller_read_own on public.discount_campaigns
for select
using (created_by = auth.uid() and public.can_current_user_sell());
