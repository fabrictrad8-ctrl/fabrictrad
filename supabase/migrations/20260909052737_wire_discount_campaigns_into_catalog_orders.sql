-- Reconstructed from the applied live migration 20260909052737_wire_discount_campaigns_into_catalog_orders.
-- ============================================================================
-- Discount/coupon engine: wire the existing discount_campaigns admin CRUD
-- (src/app/api/admin/discounts) into the real live order path
-- (submit_catalog_order_request -> catalog_order_requests), which currently
-- has zero discount awareness. The existing record_discount_redemption()
-- RPC and discount_campaign_redemptions table are bound to `bulk_orders`,
-- which has zero rows and no code path creating it anywhere in the app -
-- effectively dead scaffolding for an order flow that doesn't exist. This
-- migration does NOT touch either; it adds new columns directly on
-- catalog_order_requests instead, matched to the flow that is actually live.
--
-- Verified before applying: a full rollback-wrapped transaction against this
-- production schema (synthetic buyer/seller/product/campaign rows, real
-- triggers fired, then ROLLBACK) confirmed correct GST-on-post-discount
-- math, case-insensitive coupon code matching, invalid-code rejection,
-- usage_limit enforcement under the row lock, and graceful no-discount
-- fallback once a limited campaign is exhausted.
-- ============================================================================

-- 1. A "Coupon Code" campaign type existed with no field to hold the actual
--    code text buyers would type in. Case-insensitively unique when set.
alter table public.discount_campaigns add column if not exists code text;
create unique index if not exists discount_campaigns_code_unique_idx
  on public.discount_campaigns (lower(code)) where code is not null;

-- 2. Where a resolved discount lands on the order itself.
alter table public.catalog_order_requests
  add column if not exists discount_campaign_id uuid references public.discount_campaigns(id),
  add column if not exists discount_amount numeric not null default 0;
alter table public.catalog_order_requests
  add constraint catalog_order_requests_discount_amount_check check (discount_amount >= 0);

-- 3. Single source of truth for "is a discount eligible, and how much" -
--    called once from the pricing trigger below. Locks the campaign row
--    (FOR UPDATE) and increments usage_count atomically with the caller's
--    transaction, so a failed/rolled-back order never consumes a redemption
--    and concurrent submissions can't race past usage_limit.
--    Deliberately does NOT auto-apply 'Buyer-specific' (the admin campaign
--    form has no field to record which buyer it targets - there is no data
--    to check against) or 'Free Shipping' (there is no separate shipping-fee
--    line item on this order to waive; applying it as a price discount would
--    misrepresent what the campaign is for). Both remain creatable in the
--    admin UI but simply won't be picked up here until those gaps are
--    addressed on purpose.
create or replace function public.resolve_active_discount(
  p_product_id uuid,
  p_seller_id uuid,
  p_category text,
  p_buyer_id uuid,
  p_gross_subtotal numeric,
  p_discount_code text
) returns table(campaign_id uuid, discount_amount numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  candidate public.discount_campaigns%rowtype;
  computed_amount numeric;
  today date := current_date;
begin
  if p_discount_code is not null and length(trim(p_discount_code)) > 0 then
    select * into candidate
    from public.discount_campaigns c
    where lower(c.code) = lower(trim(p_discount_code))
      and c.campaign_type = 'Coupon Code'
      and c.status <> 'paused'
      and today between c.start_date and c.end_date
      and c.min_order_value <= p_gross_subtotal
      and (c.usage_limit is null or c.usage_count < c.usage_limit)
    for update;

    if not found then
      raise exception 'This discount code is invalid, expired, or no longer applies to this order' using errcode = 'FT001';
    end if;
  else
    select * into candidate
    from public.discount_campaigns c
    where c.status <> 'paused'
      and today between c.start_date and c.end_date
      and c.min_order_value <= p_gross_subtotal
      and (c.usage_limit is null or c.usage_count < c.usage_limit)
      and (
        (c.campaign_type = 'Website-wide')
        or (c.campaign_type = 'Product-specific' and c.target_product_key = p_product_id::text)
        or (c.campaign_type = 'Category' and c.target_product_key = p_category)
        or (c.campaign_type = 'Seller-specific' and c.target_product_key = p_seller_id::text)
        or (c.campaign_type in ('Flash Sale', 'Festival Offer'))
        or (
          c.campaign_type = 'First-order'
          and not exists (
            select 1 from public.catalog_order_requests o
            where o.buyer_id = p_buyer_id and o.status in ('paid', 'fulfilled')
          )
        )
      )
    order by c.discount_percent desc
    limit 1
    for update;
  end if;

  if candidate.id is null then
    return query select null::uuid, 0::numeric;
    return;
  end if;

  computed_amount := round(p_gross_subtotal * candidate.discount_percent / 100, 2);
  if candidate.max_discount is not null then
    computed_amount := least(computed_amount, candidate.max_discount);
  end if;
  -- Never let a discount take the order to zero/negative - catalog_order_requests
  -- requires subtotal > 0 and total_amount > 0.
  computed_amount := least(computed_amount, round(p_gross_subtotal - 0.01, 2));
  computed_amount := greatest(computed_amount, 0);

  update public.discount_campaigns
  set usage_count = usage_count + 1, updated_at = now()
  where id = candidate.id;

  return query select candidate.id, computed_amount;
end;
$$;

-- 4. Wire it into the real pricing trigger, right after subtotal is known
--    and before GST is computed on it (GST is charged on the post-discount
--    value, matching normal Indian invoicing practice). This is the ONLY
--    change to this function's existing logic - everything else, including
--    every line below the new block, is untouched from the version already
--    live in production.
create or replace function public.enforce_catalog_order_policy_and_tax()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  buyer public.buyer_profiles%rowtype;
  buyer_user public.user_profiles%rowtype;
  seller public.seller_profiles%rowtype;
  seller_user public.user_profiles%rowtype;
  product public.seller_products%rowtype;
  variant public.seller_product_variants%rowtype;
  rule public.seller_catalog_rules%rowtype;
  effective_min numeric;
  effective_max numeric;
  effective_mode text;
  effective_end_user_enabled boolean;
  effective_price numeric;
  effective_gst_rate numeric;
  effective_price_includes_gst boolean;
  available_to_sell numeric;
  buyer_state text;
  seller_state text;
  tax_total numeric;
  break_price numeric;
  discount_hint text;
  resolved_discount record;
begin
  select * into buyer from public.buyer_profiles where user_id = new.buyer_id and is_active = true;
  if not found then raise exception 'Active buyer profile not found'; end if;
  select * into buyer_user from public.user_profiles where id = new.buyer_id and is_active = true;
  if not found or coalesce(buyer_user.can_buy, false) = false then raise exception 'Buying access is not enabled'; end if;

  select * into product from public.seller_products where id = new.product_id and status = 'active' and approval_status = 'approved';
  if not found then raise exception 'Product is not available for ordering'; end if;

  if new.variant_id is not null then
    select * into variant from public.seller_product_variants
    where id = new.variant_id and product_id = product.id and status = 'active' and approval_status = 'approved';
    if not found then raise exception 'Product variation is not available'; end if;
  else
    variant := null;
  end if;

  select * into seller from public.seller_profiles where id = product.seller_id and is_active = true;
  if not found then raise exception 'Seller profile is not active'; end if;
  select * into seller_user from public.user_profiles where id = seller.user_id;

  new.seller_id := product.seller_id;
  new.buyer_type := buyer.buyer_type;
  new.unit := coalesce(variant.unit, product.unit);
  available_to_sell := greatest(coalesce(variant.available_quantity, product.available_quantity) - coalesce(variant.reserved_quantity, product.reserved_quantity), 0);
  if new.quantity <= 0 or new.quantity > available_to_sell then
    raise exception 'Requested quantity is outside the available stock';
  end if;

  if buyer.buyer_type = 'end_user' then
    if product.sale_channel not in ('retail', 'both') then raise exception 'This listing is available only to business buyers'; end if;
    effective_end_user_enabled := coalesce(variant.end_user_enabled, product.end_user_enabled, false);
    effective_mode := coalesce(variant.end_user_limit_mode, product.end_user_limit_mode, 'disabled');
    if not effective_end_user_enabled or effective_mode = 'disabled' then raise exception 'Personal purchases are disabled for this listing'; end if;
    if effective_mode = 'same_as_retail_store' then
      effective_min := coalesce(variant.retail_store_min_quantity, product.retail_store_min_quantity, variant.moq, product.moq, 1);
      effective_max := coalesce(variant.retail_store_max_quantity, product.retail_store_max_quantity);
    else
      effective_min := coalesce(variant.end_user_min_quantity, product.end_user_min_quantity, 1);
      effective_max := coalesce(variant.end_user_max_quantity, product.end_user_max_quantity);
    end if;
  else
    if product.sale_channel = 'retail' then raise exception 'This listing is available only to personal buyers'; end if;
    effective_min := coalesce(variant.retail_store_min_quantity, product.retail_store_min_quantity, variant.moq, product.moq, 1);
    effective_max := coalesce(variant.retail_store_max_quantity, product.retail_store_max_quantity);
  end if;

  if new.quantity < greatest(effective_min, 0) then
    raise exception 'Minimum permitted quantity is % %', effective_min, new.unit;
  end if;
  if effective_max is not null and new.quantity > effective_max then
    raise exception 'Maximum permitted quantity is % %', effective_max, new.unit;
  end if;

  rule := null;
  if buyer.buyer_type = 'retail_store' then
    select r.* into rule
    from public.seller_catalog_rules r
    join public.seller_catalogs c on c.id = r.catalog_id
    where r.product_id = product.id
      and (r.variant_id is null or r.variant_id = new.variant_id)
      and c.seller_id = product.seller_id
      and c.status = 'active'
      and (c.scope = 'all_buyers' or (c.scope = 'company' and c.company_id = new.company_id))
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
    order by (r.variant_id is not null) desc, (c.company_id is not null) desc, r.updated_at desc
    limit 1;
  end if;

  if rule.id is not null then
    if new.quantity < rule.minimum_quantity then raise exception 'Catalog minimum quantity is % %', rule.minimum_quantity, new.unit; end if;
    if rule.maximum_quantity is not null and new.quantity > rule.maximum_quantity then raise exception 'Catalog maximum quantity is % %', rule.maximum_quantity, new.unit; end if;
    effective_price := coalesce(rule.price_override, variant.price_per_unit, product.price_per_unit);
    select (entry->>'price')::numeric into break_price
    from jsonb_array_elements(coalesce(rule.price_breaks, '[]'::jsonb)) entry
    where (entry->>'minimum_quantity')::numeric <= new.quantity
    order by (entry->>'minimum_quantity')::numeric desc
    limit 1;
    effective_price := coalesce(break_price, effective_price);
  else
    effective_price := coalesce(variant.price_per_unit, product.price_per_unit);
  end if;

  effective_gst_rate := coalesce(variant.gst_rate, product.gst_rate, 0);
  effective_price_includes_gst := coalesce(variant.price_includes_gst, product.price_includes_gst, false);
  new.price_per_unit := round(effective_price, 2);
  new.subtotal := round(new.quantity * effective_price, 2);
  new.gst_rate := effective_gst_rate;
  new.price_includes_gst := effective_price_includes_gst;
  new.hsn_code := product.hsn_code;

  -- New: resolve and apply an eligible discount before GST is computed.
  discount_hint := nullif(current_setting('fabrictrad.discount_hint', true), '');
  select * into resolved_discount
  from public.resolve_active_discount(new.product_id, product.seller_id, product.category, new.buyer_id, new.subtotal, discount_hint);
  new.discount_campaign_id := resolved_discount.campaign_id;
  new.discount_amount := coalesce(resolved_discount.discount_amount, 0);
  if new.discount_amount > 0 then
    new.subtotal := round(new.subtotal - new.discount_amount, 2);
  end if;

  if effective_price_includes_gst and effective_gst_rate > 0 then
    tax_total := round(new.subtotal - (new.subtotal / (1 + effective_gst_rate / 100)), 2);
    new.total_amount := new.subtotal;
  else
    tax_total := round(new.subtotal * effective_gst_rate / 100, 2);
    new.total_amount := round(new.subtotal + tax_total, 2);
  end if;
  new.gst_amount := tax_total;

  new.buyer_gstin := case when buyer.gstin_status = 'active' then buyer.gstin else null end;
  new.buyer_gstin_verified := buyer.gstin_status = 'active';
  new.seller_gstin := case when seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false) then seller.gstin else null end;
  new.seller_gstin_verified := seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false);
  new.tax_invoice_type := case when buyer.buyer_type = 'retail_store' and new.buyer_gstin_verified then 'b2b' else 'b2c' end;
  new.input_tax_credit_possible := new.tax_invoice_type = 'b2b' and new.seller_gstin_verified and tax_total > 0;

  buyer_state := coalesce(buyer.billing_address->>'state', buyer_user.state);
  seller_state := coalesce(seller.pickup_address->>'state', seller_user.state);
  new.place_of_supply_state := buyer_state;
  new.intra_state_supply := buyer_state is not null and seller_state is not null and lower(trim(buyer_state)) = lower(trim(seller_state));
  if new.intra_state_supply then
    new.cgst_amount := round(tax_total / 2, 2);
    new.sgst_amount := tax_total - new.cgst_amount;
    new.igst_amount := 0;
  else
    new.cgst_amount := 0;
    new.sgst_amount := 0;
    new.igst_amount := tax_total;
  end if;
  new.tax_note := case
    when new.input_tax_credit_possible then 'GST charged on the tax invoice. The registered buyer may claim eligible input tax credit subject to GST law and return matching.'
    when new.tax_invoice_type = 'b2b' then 'Buyer GSTIN recorded. Input tax credit depends on seller GST status, invoice validity and statutory conditions.'
    else 'Consumer invoice. GST, where applicable, remains payable and is not removed by entering a GSTIN.'
  end;
  return new;
end;
$function$;

-- 5. Accept an optional discount code on the RPC and pass it to the trigger
--    via a transaction-local setting (the trigger fires on NEW row values
--    only, so this is the standard way to hand it an out-of-band hint
--    without adding a persisted "requested code" column to the table).
--    Every existing line is unchanged except the discount hint set before
--    the INSERT and the discount fields added to both JSON return branches.
create or replace function public.submit_catalog_order_request(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_company_id uuid default null,
  p_company_location_id uuid default null,
  p_purchase_order_number text default null,
  p_payment_terms text default 'due_on_order',
  p_deposit_percent numeric default 0,
  p_requires_review boolean default false,
  p_notes text default null,
  p_discount_code text default null
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
