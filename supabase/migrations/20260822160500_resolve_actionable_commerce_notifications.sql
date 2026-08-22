create or replace function public.emit_catalog_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller_user_id uuid;
  product_name text;
  amount_text text;
begin
  select sp.user_id into seller_user_id
  from public.seller_profiles sp
  where sp.id = new.seller_id;

  select p.name into product_name
  from public.seller_products p
  where p.id = new.product_id;

  product_name := coalesce(product_name, 'Marketplace product');
  amount_text := '₹' || to_char(coalesce(new.total_amount, 0), 'FM999999990.00');

  if tg_op = 'INSERT' then
    if seller_user_id is not null then
      insert into public.commerce_notifications(
        user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
      ) values (
        seller_user_id,'seller','new_order','New order request',
        product_name || ' · ' || new.quantity || ' ' || new.unit || ' · ' || amount_text,
        '/seller-dashboard?tab=orders&order=' || new.id,
        'catalog_order',new.id,'catalog:' || new.id || ':new_order',
        jsonb_build_object('productName', product_name, 'quantity', new.quantity, 'unit', new.unit, 'totalAmount', new.total_amount)
      ) on conflict (dedupe_key) do nothing;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('accepted','rejected') then
      update public.commerce_notifications
      set is_read = true, read_at = coalesce(read_at, now())
      where dedupe_key = 'catalog:' || new.id || ':new_order';
    end if;

    if new.status = 'accepted' then
      insert into public.commerce_notifications(
        user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
      ) values (
        new.buyer_id,'buyer','order_accepted','Seller accepted your order',
        product_name || ' is ready for payment · ' || amount_text,
        '/buyer-dashboard?tab=orders&order=' || new.id,
        'catalog_order',new.id,'catalog:' || new.id || ':accepted',
        jsonb_build_object('productName', product_name, 'totalAmount', new.total_amount)
      ) on conflict (dedupe_key) do nothing;
    elsif new.status = 'rejected' then
      insert into public.commerce_notifications(
        user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
      ) values (
        new.buyer_id,'buyer','order_rejected','Order request declined',
        product_name || ' was declined by the seller.',
        '/buyer-dashboard?tab=orders&order=' || new.id,
        'catalog_order',new.id,'catalog:' || new.id || ':rejected',
        jsonb_build_object('productName', product_name)
      ) on conflict (dedupe_key) do nothing;
    elsif new.status = 'fulfilled' then
      insert into public.commerce_notifications(
        user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
      ) values (
        new.buyer_id,'buyer','order_fulfilled','Order fulfilled',
        product_name || ' has been delivered and fulfilled.',
        '/buyer-dashboard?tab=tracking&order=' || new.id,
        'catalog_order',new.id,'catalog:' || new.id || ':fulfilled',
        jsonb_build_object('productName', product_name)
      ) on conflict (dedupe_key) do nothing;
    end if;
  end if;

  if new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
    update public.commerce_notifications
    set is_read = true, read_at = coalesce(read_at, now())
    where dedupe_key = 'catalog:' || new.id || ':accepted';

    if seller_user_id is not null then
      insert into public.commerce_notifications(
        user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
      ) values (
        seller_user_id,'seller','payment_received','Payment received — ship this order',
        product_name || ' is fully paid · ' || amount_text,
        '/seller-dashboard?tab=orders&order=' || new.id,
        'catalog_order',new.id,'catalog:' || new.id || ':paid',
        jsonb_build_object('productName', product_name, 'totalAmount', new.total_amount)
      ) on conflict (dedupe_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;
