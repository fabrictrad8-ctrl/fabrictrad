create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
  );
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.role::text
      from public.user_profiles profile
      where profile.id = auth.uid()
        and profile.is_active = true
      limit 1
    ),
    'buyer'
  );
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles profile
    join public.seller_profiles seller on seller.user_id = profile.id
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.can_sell = true
      and seller.is_active = true
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.get_my_role() from public, anon;
revoke all on function public.is_seller() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.is_seller() to authenticated, service_role;

drop policy if exists "super_admin_access_bank_profiles" on public.seller_bank_profiles;
create policy "super_admin_access_bank_profiles"
on public.seller_bank_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and profile.role = 'super_admin'::public.user_role
  )
)
with check (
  exists (
    select 1
    from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.is_active = true
      and profile.role = 'super_admin'::public.user_role
  )
);

drop policy if exists "public_read_seller_profiles" on public.seller_profiles;
create policy "authenticated_read_verified_seller_profiles"
on public.seller_profiles
for select
to authenticated
using (is_active = true and verification_status = 'verified'::public.seller_status);

drop policy if exists "public_read_active_seller_products" on public.seller_products;
create policy "authenticated_read_active_seller_products"
on public.seller_products
for select
to authenticated
using (
  status = 'active'
  and approval_status = 'approved'
  and exists (
    select 1
    from public.seller_profiles seller
    where seller.id = seller_products.seller_id
      and seller.is_active = true
      and seller.verification_status = 'verified'::public.seller_status
  )
);

drop policy if exists "public_read_active_product_variants" on public.seller_product_variants;
create policy "authenticated_read_active_product_variants"
on public.seller_product_variants
for select
to authenticated
using (
  status = 'active'
  and approval_status = 'approved'
  and exists (
    select 1
    from public.seller_products product
    join public.seller_profiles seller on seller.id = product.seller_id
    where product.id = seller_product_variants.product_id
      and product.seller_id = seller_product_variants.seller_id
      and product.status = 'active'
      and product.approval_status = 'approved'
      and seller.is_active = true
      and seller.verification_status = 'verified'::public.seller_status
  )
);

drop policy if exists "public_read_active_product_media" on public.seller_product_media;
create policy "authenticated_read_active_product_media"
on public.seller_product_media
for select
to authenticated
using (
  exists (
    select 1
    from public.seller_products product
    join public.seller_profiles seller on seller.id = product.seller_id
    where product.id = seller_product_media.product_id
      and product.seller_id = seller_product_media.seller_id
      and product.status = 'active'
      and product.approval_status = 'approved'
      and seller.is_active = true
      and seller.verification_status = 'verified'::public.seller_status
  )
);

drop policy if exists "Public read categories" on public.seller_categories;
create policy "Authenticated read categories"
on public.seller_categories
for select
to authenticated
using (true);

drop policy if exists "seller_reviews_read_all" on public.seller_reviews;
create policy "authenticated_read_seller_reviews"
on public.seller_reviews
for select
to authenticated
using (true);

drop policy if exists "discount_campaigns_read" on public.discount_campaigns;
create policy "discount_campaigns_authenticated_read"
on public.discount_campaigns
for select
to authenticated
using (
  (
    status = 'active'
    and current_date between start_date and end_date
    and (usage_limit is null or usage_count < usage_limit)
  )
  or public.is_admin()
);

drop policy if exists "Anyone can view open requirements" on public.buyer_requirements;
create policy "Authenticated users view open requirements"
on public.buyer_requirements
for select
to authenticated
using (status = 'open' or (select auth.uid()) = buyer_id);

revoke select on table public.seller_profiles from anon;
revoke select on table public.seller_products from anon;
revoke select on table public.seller_product_variants from anon;
revoke select on table public.seller_product_media from anon;
revoke select on table public.seller_reviews from anon;
revoke select on table public.seller_categories from anon;
revoke select on table public.discount_campaigns from anon;
revoke select on table public.buyer_requirements from anon;

grant select on table public.seller_profiles to authenticated;
grant select on table public.seller_products to authenticated;
grant select on table public.seller_product_variants to authenticated;
grant select on table public.seller_product_media to authenticated;
grant select on table public.seller_reviews to authenticated;
grant select on table public.seller_categories to authenticated;
grant select on table public.discount_campaigns to authenticated;
grant select on table public.buyer_requirements to authenticated;
