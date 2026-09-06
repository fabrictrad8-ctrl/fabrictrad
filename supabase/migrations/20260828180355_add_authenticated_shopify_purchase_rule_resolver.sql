create or replace function public.get_shopify_purchase_rule(
  p_shopify_product_gid text,
  p_variant_sku text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_buyer public.buyer_profiles%rowtype;
  v_product public.seller_products%rowtype;
  v_variant public.seller_product_variants%rowtype;
  v_is_retail boolean := false;
  v_enabled boolean := true;
  v_min numeric := 1;
  v_max numeric := null;
  v_available numeric := 0;
  v_unit text := 'unit';
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_profiles up
    where up.id = v_uid
      and up.is_active = true
      and up.can_buy = true
      and up.role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
  ) then
    raise exception 'Active buyer access required' using errcode = '42501';
  end if;

  select * into v_buyer from public.buyer_profiles where user_id = v_uid;
  if not found or v_buyer.is_active is not true then
    return jsonb_build_object('allowed', false, 'reason', 'buyer_profile_not_active');
  end if;

  select product.* into v_product
  from public.shopify_product_links link
  join public.seller_products product on product.id = link.seller_product_id
  join public.seller_profiles seller on seller.id = product.seller_id
  where link.shopify_product_gid = nullif(btrim(p_shopify_product_gid), '')
    and product.status = 'active'
    and product.approval_status = 'approved'
    and seller.is_active = true
    and seller.verification_status = 'verified'::public.seller_status
  limit 1;

  if v_product.id is null then
    return jsonb_build_object('allowed', false, 'reason', 'listing_not_available');
  end if;

  if nullif(btrim(coalesce(p_variant_sku, '')), '') is not null then
    select * into v_variant
    from public.seller_product_variants variant
    where variant.product_id = v_product.id
      and variant.variant_code = btrim(p_variant_sku)
      and variant.status = 'active'
      and variant.approval_status = 'approved'
    order by variant.updated_at desc
    limit 1;
  end if;

  v_is_retail := coalesce(v_buyer.buyer_type, 'end_user') = 'retail_store';

  if v_variant.id is not null then
    v_available := greatest(coalesce(v_variant.available_quantity, 0), 0);
    v_unit := coalesce(nullif(v_variant.unit_label, ''), nullif(v_variant.unit, ''), nullif(v_product.unit_label, ''), nullif(v_product.unit, ''), 'unit');
    if v_is_retail then
      v_enabled := true;
      v_min := greatest(coalesce(v_variant.retail_store_min_quantity, v_variant.moq, v_product.retail_store_min_quantity, v_product.moq, 1), 1);
      v_max := coalesce(v_variant.retail_store_max_quantity, v_product.retail_store_max_quantity);
    else
      v_enabled := coalesce(v_variant.end_user_enabled, v_product.end_user_enabled, true);
      v_min := greatest(coalesce(v_variant.end_user_min_quantity, v_product.end_user_min_quantity, 1), 1);
      v_max := coalesce(v_variant.end_user_max_quantity, v_product.end_user_max_quantity);
    end if;
  else
    v_available := greatest(coalesce(v_product.available_quantity, 0), 0);
    v_unit := coalesce(nullif(v_product.unit_label, ''), nullif(v_product.unit, ''), 'unit');
    if v_is_retail then
      v_enabled := true;
      v_min := greatest(coalesce(v_product.retail_store_min_quantity, v_product.moq, 1), 1);
      v_max := v_product.retail_store_max_quantity;
    else
      v_enabled := coalesce(v_product.end_user_enabled, true);
      v_min := greatest(coalesce(v_product.end_user_min_quantity, 1), 1);
      v_max := v_product.end_user_max_quantity;
    end if;
  end if;

  if v_max is not null then
    v_max := least(v_max, v_available);
  else
    v_max := v_available;
  end if;

  return jsonb_build_object(
    'allowed', (v_enabled and v_available >= v_min),
    'reason', case
      when not v_enabled then 'buyer_type_not_enabled'
      when v_available < v_min then 'insufficient_inventory'
      else null
    end,
    'sellerProductId', v_product.id,
    'sellerProductVariantId', v_variant.id,
    'buyerType', coalesce(v_buyer.buyer_type, 'end_user'),
    'businessKycStatus', v_buyer.business_kyc_status,
    'minQuantity', v_min,
    'maxQuantity', v_max,
    'availableQuantity', v_available,
    'unit', v_unit
  );
end;
$function$;

revoke all on function public.get_shopify_purchase_rule(text,text) from public, anon;
grant execute on function public.get_shopify_purchase_rule(text,text) to authenticated;
