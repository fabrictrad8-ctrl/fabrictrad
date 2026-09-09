-- A buyer could place an order — committing the seller's stock — and pay in
-- full, with no address the order could ever ship to. Fulfilment
-- (/api/shiprocket/create-order) refuses an incomplete address, so the order
-- became stuck after the money moved. The gate belongs at order creation, the
-- point where stock is actually committed, and in the database so no client
-- can bypass it.
--
-- The full submit_catalog_order_request body is reapplied here unchanged apart
-- from the single address check, so this file reproduces the live function.
create or replace function public.buyer_has_shippable_address(p_buyer uuid, p_company_location_id uuid default null)
 returns boolean
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  a jsonb;
  line1 text; city text; state text; pin text;
  up record;
begin
  -- Same precedence as the shipment route: a B2B company location's address
  -- wins when the order has one, otherwise the buyer's own profile.
  if p_company_location_id is not null then
    select coalesce(l.shipping_address, l.billing_address) into a
    from public.b2b_company_locations l where l.id = p_company_location_id;
    if a is not null then
      line1 := coalesce(a->>'line1', a->>'address_line1', a->>'address');
      city  := a->>'city';
      state := a->>'state';
      pin   := coalesce(a->>'pincode', a->>'postal_code');
      return coalesce(length(btrim(coalesce(line1,''))),0) >= 3
         and coalesce(btrim(coalesce(city,'')),'') <> ''
         and coalesce(btrim(coalesce(state,'')),'') <> ''
         and coalesce(btrim(coalesce(pin,'')),'') ~ '^[1-9][0-9]{5}$';
    end if;
  end if;

  select bp.billing_address into a from public.buyer_profiles bp where bp.user_id = p_buyer;
  select u.address_line1, u.city, u.state, u.pincode into up
  from public.user_profiles u where u.id = p_buyer;

  line1 := coalesce(nullif(btrim(coalesce(a->>'line1', a->>'address_line1')),''), up.address_line1);
  city  := coalesce(nullif(btrim(coalesce(a->>'city','')),''), up.city);
  state := coalesce(nullif(btrim(coalesce(a->>'state','')),''), up.state);
  pin   := coalesce(nullif(btrim(coalesce(a->>'pincode','')),''), up.pincode);

  return coalesce(length(btrim(coalesce(line1,''))),0) >= 3
     and coalesce(btrim(coalesce(city,'')),'') <> ''
     and coalesce(btrim(coalesce(state,'')),'') <> ''
     and coalesce(btrim(coalesce(pin,'')),'') ~ '^[1-9][0-9]{5}$';
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_catalog_order_request(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_company_id uuid DEFAULT NULL::uuid, p_company_location_id uuid DEFAULT NULL::uuid, p_purchase_order_number text DEFAULT NULL::text, p_payment_terms text DEFAULT 'due_on_order'::text, p_deposit_percent numeric DEFAULT 0, p_requires_review boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_discount_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := auth.uid();
  product_seller_id uuid;
  product_unit text;
  available_stock numeric;
  reserved_stock numeric;
  due_at timestamptz;
  created public.catalog_order_requests%rowtype;
  existing_order public.catalog_order_requests%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if not exists (
    select 1 from public.user_profiles up
    join public.buyer_profiles bp on bp.user_id = up.id
    where up.id = current_user_id and up.is_active = true
      and up.role = 'buyer'::public.user_role and coalesce(up.can_buy,true) = true and bp.is_active = true
  ) then
    raise exception 'Buyer workspace access is required to place or reuse an order' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_product_id::text || ':' || coalesce(p_variant_id::text,''),0));

  select seller_id,unit into product_seller_id,product_unit
  from public.seller_products where id = p_product_id;
  if product_seller_id is null then raise exception 'Product not found'; end if;

  select * into existing_order
  from public.catalog_order_requests
  where buyer_id = current_user_id and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and status in ('pending','accepted','paid')
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object(
      'id',existing_order.id,'orderRef',existing_order.id,'existing',true,
      'status',existing_order.status,'paymentStatus',existing_order.payment_status,
      'requiresReview',existing_order.requires_review,'reviewStatus',existing_order.review_status,
      'buyerType',existing_order.buyer_type,'quantity',existing_order.quantity,'unit',existing_order.unit,
      'pricePerUnit',existing_order.price_per_unit,'subtotal',existing_order.subtotal,
      'gstAmount',existing_order.gst_amount,'totalAmount',existing_order.total_amount,
      'discountAmount',existing_order.discount_amount,'discountCampaignId',existing_order.discount_campaign_id,
      'invoiceType',existing_order.tax_invoice_type,'inputTaxCreditPossible',existing_order.input_tax_credit_possible,
      'taxNote',existing_order.tax_note
    );
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.b2b_company_accounts c
    where c.id=p_company_id and c.owner_user_id=current_user_id and c.status='active'
  ) then raise exception 'Company account does not belong to this buyer or is not active' using errcode='42501'; end if;
  if p_company_location_id is not null and (
    p_company_id is null or not exists (
      select 1 from public.b2b_company_locations l where l.id=p_company_location_id and l.company_id=p_company_id
    )
  ) then raise exception 'Company location does not belong to the selected company' using errcode='42501'; end if;

  -- Refuse before any stock is committed. Checked here rather than at payment
  -- because order creation is what decrements the seller's available stock.
  if not public.buyer_has_shippable_address(current_user_id, p_company_location_id) then
    raise exception 'Add a complete delivery address (street, city, state and 6-digit PIN code) before placing this order, otherwise it cannot be shipped'
      using errcode = 'FT002';
  end if;

  if p_variant_id is not null then
    select available_quantity,reserved_quantity into available_stock,reserved_stock
    from public.seller_product_variants
    where id=p_variant_id and product_id=p_product_id and seller_id=product_seller_id
    for update;
    if not found or p_quantity > greatest(coalesce(available_stock,0)-coalesce(reserved_stock,0),0) then
      raise exception 'Requested quantity is outside the available stock';
    end if;
  else
    select available_quantity,reserved_quantity into available_stock,reserved_stock
    from public.seller_products where id=p_product_id and seller_id=product_seller_id for update;
    if not found or p_quantity > greatest(coalesce(available_stock,0)-coalesce(reserved_stock,0),0) then
      raise exception 'Requested quantity is outside the available stock';
    end if;
  end if;

  due_at := case coalesce(nullif(trim(p_payment_terms),''),'due_on_order')
    when 'due_on_fulfillment' then null
    when 'net_7' then now()+interval '7 days'
    when 'net_15' then now()+interval '15 days'
    when 'net_30' then now()+interval '30 days'
    when 'net_45' then now()+interval '45 days'
    when 'net_60' then now()+interval '60 days'
    when 'net_90' then now()+interval '90 days'
    else now()+interval '48 hours'
  end;

  perform set_config('fabrictrad.discount_hint', coalesce(nullif(trim(p_discount_code),''), ''), true);

  insert into public.catalog_order_requests(
    buyer_id,seller_id,product_id,variant_id,quantity,unit,
    price_per_unit,subtotal,gst_amount,total_amount,status,
    company_id,company_location_id,purchase_order_number,
    payment_terms,deposit_percent,payment_due_at,requires_review,review_status,notes
  ) values (
    current_user_id,product_seller_id,p_product_id,p_variant_id,p_quantity,
    coalesce((select v.unit from public.seller_product_variants v where v.id=p_variant_id and v.product_id=p_product_id),product_unit),
    0,0,0,0,
    case when coalesce(p_requires_review,false) then 'pending' else 'accepted' end,
    p_company_id,p_company_location_id,nullif(trim(p_purchase_order_number),''),
    coalesce(nullif(trim(p_payment_terms),''),'due_on_order'),
    greatest(least(coalesce(p_deposit_percent,0),100),0),
    case when coalesce(p_requires_review,false) then null else due_at end,
    coalesce(p_requires_review,false),
    case when coalesce(p_requires_review,false) then 'pending' else 'not_required' end,
    left(nullif(trim(p_notes),''),2000)
  ) returning * into created;

  if created.requires_review then
    if created.variant_id is not null then
      update public.seller_product_variants
      set reserved_quantity=coalesce(reserved_quantity,0)+created.quantity,updated_at=now()
      where id=created.variant_id and product_id=created.product_id and seller_id=created.seller_id;
    else
      update public.seller_products
      set reserved_quantity=coalesce(reserved_quantity,0)+created.quantity,updated_at=now()
      where id=created.product_id and seller_id=created.seller_id;
    end if;
  else
    if created.variant_id is not null then
      update public.seller_product_variants
      set available_quantity=available_quantity-created.quantity,updated_at=now()
      where id=created.variant_id and product_id=created.product_id and seller_id=created.seller_id;
    else
      update public.seller_products
      set available_quantity=available_quantity-created.quantity,updated_at=now()
      where id=created.product_id and seller_id=created.seller_id;
    end if;
  end if;

  return jsonb_build_object(
    'id',created.id,'orderRef',created.id,'existing',false,
    'status',created.status,'paymentStatus',created.payment_status,
    'requiresReview',created.requires_review,'reviewStatus',created.review_status,
    'buyerType',created.buyer_type,'quantity',created.quantity,'unit',created.unit,
    'pricePerUnit',created.price_per_unit,'subtotal',created.subtotal,
    'gstAmount',created.gst_amount,'totalAmount',created.total_amount,
    'discountAmount',created.discount_amount,'discountCampaignId',created.discount_campaign_id,
    'invoiceType',created.tax_invoice_type,'inputTaxCreditPossible',created.input_tax_credit_possible,
    'taxNote',created.tax_note
  );
end;
$function$;
