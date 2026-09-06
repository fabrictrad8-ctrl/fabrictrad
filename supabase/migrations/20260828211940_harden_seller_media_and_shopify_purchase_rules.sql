create or replace function public.enforce_seller_product_media_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_images integer;
  v_videos integer;
begin
  if not exists (
    select 1 from public.seller_products p
    where p.id = new.product_id and p.seller_id = new.seller_id
  ) then
    raise exception 'Product does not belong to this seller' using errcode='23503';
  end if;

  if new.variant_id is not null and not exists (
    select 1 from public.seller_product_variants v
    where v.id = new.variant_id and v.product_id = new.product_id and v.seller_id = new.seller_id
  ) then
    raise exception 'Variant does not belong to this product and seller' using errcode='23503';
  end if;

  select count(*) into v_images
  from public.seller_product_media m
  where m.product_id = new.product_id and m.media_type='image'
    and (tg_op <> 'UPDATE' or m.id <> old.id);

  select count(*) into v_videos
  from public.seller_product_media m
  where m.product_id = new.product_id and m.media_type='video'
    and (tg_op <> 'UPDATE' or m.id <> old.id);

  if new.media_type='image' and v_images >= 8 then
    raise exception 'A product can have at most 8 images' using errcode='23514';
  end if;

  if new.media_type='video' then
    if v_videos >= 1 then
      raise exception 'A product can have at most 1 product video' using errcode='23514';
    end if;
    if new.duration_seconds is null or new.duration_seconds < 10 or new.duration_seconds > 20 then
      raise exception 'Product video duration must be between 10 and 20 seconds' using errcode='23514';
    end if;
  else
    new.duration_seconds := null;
  end if;

  return new;
end;
$$;

drop trigger if exists seller_product_media_rules on public.seller_product_media;
create trigger seller_product_media_rules
before insert or update on public.seller_product_media
for each row execute function public.enforce_seller_product_media_rules();

revoke all on function public.enforce_seller_product_media_rules() from public, anon, authenticated;
grant execute on function public.enforce_seller_product_media_rules() to service_role;

create or replace function public.submit_my_seller_product_for_review(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seller_id uuid;
  v_product public.seller_products%rowtype;
  v_images integer;
  v_videos integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select sp.id into v_seller_id
  from public.seller_profiles sp
  join public.user_profiles up on up.id = sp.user_id
  where sp.user_id = v_uid
    and up.is_active = true
    and coalesce(up.can_sell,false) = true
    and sp.is_active = true
    and sp.verification_status = 'verified'::public.seller_status
  limit 1;

  if v_seller_id is null then
    raise exception 'Verified Seller access is required before submitting products' using errcode='42501';
  end if;

  select * into v_product
  from public.seller_products
  where id = p_product_id and seller_id = v_seller_id;

  if not found then
    raise exception 'Seller product not found' using errcode='P0002';
  end if;

  if nullif(btrim(coalesce(v_product.name,'')),'') is null
     or nullif(btrim(coalesce(v_product.sku,'')),'') is null
     or coalesce(v_product.price_per_unit,0) <= 0
     or coalesce(v_product.moq,0) <= 0 then
    raise exception 'Product name, SKU, positive price and MOQ are required before review' using errcode='23514';
  end if;

  select count(*) filter (where media_type='image'),
         count(*) filter (where media_type='video')
    into v_images, v_videos
  from public.seller_product_media
  where product_id = p_product_id and seller_id = v_seller_id;

  if v_images < 1 or v_images > 8 then
    raise exception 'Add between 1 and 8 product images before review' using errcode='23514';
  end if;
  if v_videos > 1 then
    raise exception 'Only one product video is allowed' using errcode='23514';
  end if;
  if exists (
    select 1 from public.seller_product_media
    where product_id=p_product_id and seller_id=v_seller_id and media_type='video'
      and (duration_seconds is null or duration_seconds < 10 or duration_seconds > 20)
  ) then
    raise exception 'Product video duration must be between 10 and 20 seconds' using errcode='23514';
  end if;

  update public.seller_product_variants
     set status='draft', approval_status='pending', admin_review_notes=null, updated_at=now()
   where product_id=p_product_id and seller_id=v_seller_id and approval_status <> 'rejected';

  update public.seller_products
     set status='draft', approval_status='pending', admin_review_notes=null, updated_at=now()
   where id=p_product_id;

  return jsonb_build_object('submitted',true,'productId',p_product_id,'approvalStatus','pending','imageCount',v_images,'videoCount',v_videos);
end;
$$;

create or replace function public.validate_shopify_purchase_line_for_user(
  p_user_id uuid,
  p_shopify_product_gid text,
  p_variant_sku text,
  p_quantity numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_buyer public.buyer_profiles%rowtype;
  v_product public.seller_products%rowtype;
  v_variant public.seller_product_variants%rowtype;
  v_is_retail boolean;
  v_enabled boolean;
  v_min numeric;
  v_max numeric;
  v_available numeric;
  v_unit text;
begin
  if p_user_id is null or not exists (
    select 1 from public.user_profiles up
    where up.id=p_user_id and up.is_active=true and up.can_buy=true
      and up.role not in ('super_admin'::public.user_role,'admin_staff'::public.user_role)
  ) then
    return jsonb_build_object('allowed',false,'reason','buyer_access_not_active');
  end if;

  select * into v_buyer from public.buyer_profiles where user_id=p_user_id and is_active=true;
  if not found then return jsonb_build_object('allowed',false,'reason','buyer_profile_not_active'); end if;

  select p.* into v_product
  from public.shopify_product_links l
  join public.seller_products p on p.id=l.seller_product_id
  join public.seller_profiles s on s.id=p.seller_id
  where l.shopify_product_gid=nullif(btrim(p_shopify_product_gid),'')
    and p.status='active' and p.approval_status='approved'
    and s.is_active=true and s.verification_status='verified'::public.seller_status
  limit 1;
  if v_product.id is null then return jsonb_build_object('allowed',false,'reason','listing_not_available'); end if;

  if nullif(btrim(coalesce(p_variant_sku,'')),'') is not null then
    select * into v_variant
    from public.seller_product_variants v
    where v.product_id=v_product.id and v.variant_code=btrim(p_variant_sku)
      and v.status='active' and v.approval_status='approved'
    order by v.updated_at desc limit 1;
    if v_product.variant_count > 0 and v_variant.id is null then
      return jsonb_build_object('allowed',false,'reason','variant_not_available','sellerProductId',v_product.id,'sellerId',v_product.seller_id);
    end if;
  end if;

  v_is_retail := coalesce(v_buyer.buyer_type,'end_user')='retail_store';
  if v_variant.id is not null then
    v_available := greatest(coalesce(v_variant.available_quantity,0),0);
    v_unit := coalesce(nullif(v_variant.unit_label,''),nullif(v_variant.unit,''),nullif(v_product.unit_label,''),nullif(v_product.unit,''),'unit');
    if v_is_retail then
      v_enabled := true;
      v_min := greatest(coalesce(v_variant.retail_store_min_quantity,v_variant.moq,v_product.retail_store_min_quantity,v_product.moq,1),1);
      v_max := coalesce(v_variant.retail_store_max_quantity,v_product.retail_store_max_quantity);
    else
      v_enabled := coalesce(v_variant.end_user_enabled,v_product.end_user_enabled,true);
      v_min := greatest(coalesce(v_variant.end_user_min_quantity,v_product.end_user_min_quantity,1),1);
      v_max := coalesce(v_variant.end_user_max_quantity,v_product.end_user_max_quantity);
    end if;
  else
    v_available := greatest(coalesce(v_product.available_quantity,0),0);
    v_unit := coalesce(nullif(v_product.unit_label,''),nullif(v_product.unit,''),'unit');
    if v_is_retail then
      v_enabled := true;
      v_min := greatest(coalesce(v_product.retail_store_min_quantity,v_product.moq,1),1);
      v_max := v_product.retail_store_max_quantity;
    else
      v_enabled := coalesce(v_product.end_user_enabled,true);
      v_min := greatest(coalesce(v_product.end_user_min_quantity,1),1);
      v_max := v_product.end_user_max_quantity;
    end if;
  end if;

  v_max := least(coalesce(v_max,v_available),v_available);
  return jsonb_build_object(
    'allowed', v_enabled and v_available >= v_min and coalesce(p_quantity,0) >= v_min and coalesce(p_quantity,0) <= v_max,
    'reason', case
      when not v_enabled then 'buyer_type_not_enabled'
      when v_available < v_min then 'insufficient_inventory'
      when coalesce(p_quantity,0) < v_min then 'below_minimum_quantity'
      when coalesce(p_quantity,0) > v_max then 'above_maximum_quantity'
      else null end,
    'sellerProductId',v_product.id,
    'sellerProductVariantId',v_variant.id,
    'sellerId',v_product.seller_id,
    'minQuantity',v_min,
    'maxQuantity',v_max,
    'availableQuantity',v_available,
    'unit',v_unit,
    'buyerType',coalesce(v_buyer.buyer_type,'end_user')
  );
end;
$$;

revoke all on function public.validate_shopify_purchase_line_for_user(uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.validate_shopify_purchase_line_for_user(uuid,text,text,numeric) to service_role;
