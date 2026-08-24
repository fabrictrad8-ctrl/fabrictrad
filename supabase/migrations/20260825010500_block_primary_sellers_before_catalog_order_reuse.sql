create or replace function public.submit_catalog_order_request(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_company_id uuid default null::uuid,
  p_company_location_id uuid default null::uuid,
  p_purchase_order_number text default null::text,
  p_payment_terms text default 'due_on_order'::text,
  p_deposit_percent numeric default 0,
  p_requires_review boolean default false,
  p_notes text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  product_seller_id uuid;
  product_unit text;
  created public.catalog_order_requests%rowtype;
  existing_order public.catalog_order_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Authorize the primary buyer workspace before reusing any historical order.
  -- This prevents seller-primary accounts from reopening buyer orders that were
  -- created before workspace separation was enforced.
  if not exists (
    select 1
    from public.user_profiles up
    join public.buyer_profiles bp on bp.user_id = up.id
    where up.id = current_user_id
      and up.is_active = true
      and up.role = 'buyer'::public.user_role
      and coalesce(up.can_buy, true) = true
      and bp.is_active = true
  ) then
    raise exception 'Buyer workspace access is required to place or reuse an order'
      using errcode = '42501';
  end if;

  select seller_id, unit
    into product_seller_id, product_unit
  from public.seller_products
  where id = p_product_id;

  if product_seller_id is null then
    raise exception 'Product not found';
  end if;

  select * into existing_order
  from public.catalog_order_requests
  where buyer_id = current_user_id
    and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and status in ('pending','accepted','paid')
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id', existing_order.id,
      'orderRef', existing_order.id,
      'existing', true,
      'status', existing_order.status,
      'paymentStatus', existing_order.payment_status,
      'buyerType', existing_order.buyer_type,
      'quantity', existing_order.quantity,
      'unit', existing_order.unit,
      'pricePerUnit', existing_order.price_per_unit,
      'subtotal', existing_order.subtotal,
      'gstAmount', existing_order.gst_amount,
      'totalAmount', existing_order.total_amount,
      'invoiceType', existing_order.tax_invoice_type,
      'inputTaxCreditPossible', existing_order.input_tax_credit_possible,
      'taxNote', existing_order.tax_note
    );
  end if;

  if p_company_id is not null and not exists (
    select 1
    from public.b2b_company_accounts c
    where c.id = p_company_id
      and c.owner_user_id = current_user_id
      and c.status = 'active'
  ) then
    raise exception 'Company account does not belong to this buyer or is not active' using errcode = '42501';
  end if;

  if p_company_location_id is not null and (
    p_company_id is null or not exists (
      select 1
      from public.b2b_company_locations l
      where l.id = p_company_location_id
        and l.company_id = p_company_id
    )
  ) then
    raise exception 'Company location does not belong to the selected company' using errcode = '42501';
  end if;

  insert into public.catalog_order_requests (
    buyer_id, seller_id, product_id, variant_id, quantity, unit,
    price_per_unit, subtotal, gst_amount, total_amount, status,
    company_id, company_location_id, purchase_order_number,
    payment_terms, deposit_percent, requires_review, review_status, notes
  ) values (
    current_user_id,
    product_seller_id,
    p_product_id,
    p_variant_id,
    p_quantity,
    coalesce((select v.unit from public.seller_product_variants v where v.id = p_variant_id and v.product_id = p_product_id), product_unit),
    0,
    0,
    0,
    0,
    'pending',
    p_company_id,
    p_company_location_id,
    nullif(trim(p_purchase_order_number), ''),
    coalesce(nullif(trim(p_payment_terms), ''), 'due_on_order'),
    greatest(least(coalesce(p_deposit_percent, 0), 100), 0),
    coalesce(p_requires_review, false),
    case when coalesce(p_requires_review, false) then 'pending' else 'not_required' end,
    left(nullif(trim(p_notes), ''), 2000)
  ) returning * into created;

  return jsonb_build_object(
    'id', created.id,
    'orderRef', created.id,
    'existing', false,
    'status', created.status,
    'paymentStatus', created.payment_status,
    'buyerType', created.buyer_type,
    'quantity', created.quantity,
    'unit', created.unit,
    'pricePerUnit', created.price_per_unit,
    'subtotal', created.subtotal,
    'gstAmount', created.gst_amount,
    'totalAmount', created.total_amount,
    'invoiceType', created.tax_invoice_type,
    'inputTaxCreditPossible', created.input_tax_credit_possible,
    'taxNote', created.tax_note
  );
end;
$$;
