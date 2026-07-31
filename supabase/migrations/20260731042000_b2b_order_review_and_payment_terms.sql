create or replace function public.review_company_catalog_order(
  p_order_id uuid,
  p_decision text
)
returns public.catalog_order_requests
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_row public.catalog_order_requests%rowtype;
begin
  if p_decision not in ('approve','reject') then
    raise exception 'Unsupported review decision';
  end if;

  select request.* into request_row
  from public.catalog_order_requests request
  join public.b2b_company_accounts company on company.id = request.company_id
  where request.id = p_order_id
    and request.buyer_id = auth.uid()
    and company.owner_user_id = auth.uid()
  for update of request;

  if not found then raise exception 'Order request not found'; end if;
  if not request_row.requires_review then raise exception 'This order does not require company review'; end if;
  if request_row.status <> 'pending' then raise exception 'Only pending requests can be reviewed'; end if;
  if request_row.review_status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  if p_decision = 'approve' then
    update public.catalog_order_requests
      set review_status = 'approved',
          notes = concat_ws(E'\n', nullif(notes, ''), 'Company review: approved.'),
          updated_at = now()
      where id = p_order_id
      returning * into request_row;
  else
    update public.catalog_order_requests
      set review_status = 'rejected',
          status = 'cancelled',
          notes = concat_ws(E'\n', nullif(notes, ''), 'Company review: rejected.'),
          updated_at = now()
      where id = p_order_id
      returning * into request_row;
  end if;

  return request_row;
end;
$function$;

grant execute on function public.review_company_catalog_order(uuid, text) to authenticated;

create or replace function public.seller_decide_catalog_order(
  p_order_id uuid,
  p_action text,
  p_reason text default null
)
returns public.catalog_order_requests
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_row public.catalog_order_requests%rowtype;
  seller_profile_id uuid;
  available_stock numeric(12,2);
  due_at timestamptz;
begin
  seller_profile_id := public.my_seller_id();
  if seller_profile_id is null or not public.can_current_user_sell() then
    raise exception 'Seller access is required';
  end if;
  if p_action not in ('accept','reject') then raise exception 'Unsupported order action'; end if;

  select * into request_row
  from public.catalog_order_requests
  where id = p_order_id and seller_id = seller_profile_id
  for update;

  if not found then raise exception 'Order request not found'; end if;
  if request_row.status <> 'pending' then raise exception 'Only pending order requests can be decided'; end if;
  if request_row.requires_review and request_row.review_status <> 'approved' then
    raise exception 'Company approval is required before this order can be accepted';
  end if;

  if p_action = 'reject' then
    update public.catalog_order_requests
      set status = 'rejected',
          notes = concat_ws(E'\n', nullif(notes, ''), 'Seller rejection: ' || coalesce(nullif(trim(p_reason), ''), 'Unable to fulfil this request.')),
          updated_at = now()
      where id = p_order_id
      returning * into request_row;
    return request_row;
  end if;

  if request_row.variant_id is not null then
    select available_quantity into available_stock
    from public.seller_product_variants
    where id = request_row.variant_id
      and product_id = request_row.product_id
      and seller_id = seller_profile_id
    for update;
    if not found or available_stock < request_row.quantity then raise exception 'Not enough stock is available for this variation'; end if;
    update public.seller_product_variants
      set available_quantity = available_quantity - request_row.quantity,
          updated_at = now()
      where id = request_row.variant_id;
  else
    select available_quantity into available_stock
    from public.seller_products
    where id = request_row.product_id and seller_id = seller_profile_id
    for update;
    if not found or available_stock < request_row.quantity then raise exception 'Not enough stock is available for this product'; end if;
    update public.seller_products
      set available_quantity = available_quantity - request_row.quantity,
          updated_at = now()
      where id = request_row.product_id;
  end if;

  due_at := case request_row.payment_terms
    when 'due_on_fulfillment' then null
    when 'net_7' then now() + interval '7 days'
    when 'net_15' then now() + interval '15 days'
    when 'net_30' then now() + interval '30 days'
    when 'net_45' then now() + interval '45 days'
    when 'net_60' then now() + interval '60 days'
    when 'net_90' then now() + interval '90 days'
    else now() + interval '48 hours'
  end;

  update public.catalog_order_requests
    set status = 'accepted',
        payment_due_at = due_at,
        notes = concat_ws(E'\n', nullif(notes, ''), case when nullif(trim(p_reason), '') is null then 'Seller accepted the requested quantity.' else 'Seller acceptance note: ' || trim(p_reason) end),
        updated_at = now()
    where id = p_order_id
    returning * into request_row;

  return request_row;
end;
$function$;

grant execute on function public.seller_decide_catalog_order(uuid, text, text) to authenticated;