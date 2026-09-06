create or replace function public.enforce_shopify_order_item_purchase_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_review text;
  v_rule jsonb;
  v_original_quantity numeric;
  v_reason text;
begin
  select bp.user_id, o.review_status
    into v_user_id, v_review
  from public.orders o
  join public.buyer_profiles bp on bp.id=o.buyer_id
  where o.id=new.order_id;

  if v_user_id is null then
    return new;
  end if;

  if coalesce(v_review,'') like 'purchase_rule_violation%' then
    return null;
  end if;

  begin
    v_original_quantity := nullif(new.metadata->>'shopify_quantity','')::numeric;
  exception when others then
    v_original_quantity := null;
  end;
  v_original_quantity := coalesce(v_original_quantity,new.quantity,0);

  v_rule := public.validate_shopify_purchase_line_for_user(
    v_user_id,
    new.shopify_product_gid,
    new.sku,
    v_original_quantity
  );

  if coalesce((v_rule->>'allowed')::boolean,false) is not true then
    v_reason := coalesce(v_rule->>'reason','invalid_purchase_rule');
    delete from public.shopify_seller_order_items where order_id=new.order_id;
    update public.orders
       set status='cancelled',
           requires_review=true,
           review_status='purchase_rule_violation:'||v_reason,
           updated_at=now()
     where id=new.order_id;
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists shopify_order_item_purchase_rule on public.shopify_seller_order_items;
create trigger shopify_order_item_purchase_rule
before insert on public.shopify_seller_order_items
for each row execute function public.enforce_shopify_order_item_purchase_rule();

revoke all on function public.enforce_shopify_order_item_purchase_rule() from public, anon, authenticated;
grant execute on function public.enforce_shopify_order_item_purchase_rule() to service_role;
