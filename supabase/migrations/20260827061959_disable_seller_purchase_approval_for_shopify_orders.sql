create or replace function public.respond_to_my_seller_order(p_order_id uuid, p_decision text, p_reason text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_seller_id uuid;
  v_order public.orders%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status public.order_status;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select sp.id into v_seller_id
  from public.seller_profiles sp
  where sp.user_id = v_uid and coalesce(sp.is_active, true) = true
  limit 1;

  if v_seller_id is null then
    raise exception 'Active seller profile not found' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and seller_id = v_seller_id
  for update;

  if not found then
    raise exception 'Seller order not found' using errcode = 'P0002';
  end if;

  if coalesce(v_order.commerce_source, '') = 'shopify' then
    raise exception 'Shopify checkout orders are direct purchases and do not require seller acceptance or rejection' using errcode = '42501';
  end if;

  if v_decision not in ('accept','reject') then
    raise exception 'Decision must be accept or reject' using errcode = '22023';
  end if;

  if v_order.status not in ('pending_seller_confirmation'::public.order_status,'seller_accepted'::public.order_status,'seller_rejected'::public.order_status) then
    raise exception 'This order can no longer be accepted or rejected in its current state' using errcode = '23514';
  end if;

  if v_decision = 'reject' and v_reason is null then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;

  v_status := case when v_decision='accept' then 'seller_accepted'::public.order_status else 'seller_rejected'::public.order_status end;

  update public.orders
  set status = v_status,
      notes = case when v_decision='reject' then concat_ws(' · ', nullif(notes,''), 'Seller rejection reason: ' || v_reason) else notes end,
      updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('saved', true, 'orderId', p_order_id, 'status', v_status::text, 'requiresAdminReview', false);
end;
$function$;
