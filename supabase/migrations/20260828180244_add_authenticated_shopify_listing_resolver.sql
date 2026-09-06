create or replace function public.resolve_shopify_marketplace_product(p_shopify_product_gid text)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_product_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.id = v_uid
      and up.is_active = true
      and up.can_buy = true
      and up.role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
  ) then
    raise exception 'Active buyer access required' using errcode = '42501';
  end if;

  select link.seller_product_id
    into v_product_id
  from public.shopify_product_links link
  join public.seller_products product on product.id = link.seller_product_id
  join public.seller_profiles seller on seller.id = product.seller_id
  where link.shopify_product_gid = nullif(btrim(p_shopify_product_gid), '')
    and product.status = 'active'
    and product.approval_status = 'approved'
    and seller.is_active = true
    and seller.verification_status = 'verified'::public.seller_status
  limit 1;

  return v_product_id;
end;
$function$;

revoke all on function public.resolve_shopify_marketplace_product(text) from public, anon;
grant execute on function public.resolve_shopify_marketplace_product(text) to authenticated;
