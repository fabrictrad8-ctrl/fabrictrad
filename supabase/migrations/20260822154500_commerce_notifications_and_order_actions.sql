create table if not exists public.commerce_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('buyer','seller','system')),
  kind text not null,
  title text not null,
  message text not null,
  action_url text,
  entity_type text,
  entity_id uuid,
  dedupe_key text unique,
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commerce_notifications_user_unread_idx
  on public.commerce_notifications(user_id, is_read, created_at desc);
create index if not exists commerce_notifications_entity_idx
  on public.commerce_notifications(entity_type, entity_id);

alter table public.commerce_notifications enable row level security;

drop policy if exists commerce_notifications_read_own on public.commerce_notifications;
create policy commerce_notifications_read_own
on public.commerce_notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists commerce_notifications_update_own on public.commerce_notifications;
create policy commerce_notifications_update_own
on public.commerce_notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on public.commerce_notifications from anon;
revoke all on public.commerce_notifications from authenticated;
grant select on public.commerce_notifications to authenticated;
grant update (is_read, read_at) on public.commerce_notifications to authenticated;

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
        seller_user_id,
        'seller',
        'new_order',
        'New order request',
        product_name || ' · ' || new.quantity || ' ' || new.unit || ' · ' || amount_text,
        '/seller-dashboard?tab=orders&order=' || new.id,
        'catalog_order',
        new.id,
        'catalog:' || new.id || ':new_order',
        jsonb_build_object('productName', product_name, 'quantity', new.quantity, 'unit', new.unit, 'totalAmount', new.total_amount)
      ) on conflict (dedupe_key) do nothing;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      insert into public.commerce_notifications(
        user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
      ) values (
        new.buyer_id,
        'buyer',
        'order_accepted',
        'Seller accepted your order',
        product_name || ' is ready for payment · ' || amount_text,
        '/buyer-dashboard?tab=orders&order=' || new.id,
        'catalog_order',
        new.id,
        'catalog:' || new.id || ':accepted',
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
        product_name || ' has been marked fulfilled.',
        '/buyer-dashboard?tab=tracking&order=' || new.id,
        'catalog_order',new.id,'catalog:' || new.id || ':fulfilled',
        jsonb_build_object('productName', product_name)
      ) on conflict (dedupe_key) do nothing;
    end if;
  end if;

  if new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
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

drop trigger if exists catalog_order_notifications_trigger on public.catalog_order_requests;
create trigger catalog_order_notifications_trigger
after insert or update of status, payment_status
on public.catalog_order_requests
for each row execute function public.emit_catalog_order_notifications();

create or replace function public.emit_shipment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_uuid uuid;
  status_label text;
begin
  order_uuid := coalesce(new.catalog_order_id, new.bulk_order_id);
  if new.buyer_id is null or order_uuid is null then return new; end if;

  status_label := initcap(replace(coalesce(new.status, 'pending'), '_', ' '));

  if tg_op = 'INSERT' then
    insert into public.commerce_notifications(
      user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
    ) values (
      new.buyer_id,'buyer','shipment_created','Shipment created',
      coalesce(new.courier_name, 'Courier') || ' · ' || coalesce(new.awb_number, 'AWB pending'),
      '/buyer-dashboard?tab=tracking&order=' || order_uuid,
      'shipment',order_uuid,
      'shipment:' || new.id || ':created',
      jsonb_build_object('shipmentId', new.id, 'status', new.status, 'awb', new.awb_number, 'courier', new.courier_name)
    ) on conflict (dedupe_key) do nothing;
  elsif new.status is distinct from old.status or new.awb_number is distinct from old.awb_number then
    insert into public.commerce_notifications(
      user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata
    ) values (
      new.buyer_id,'buyer','shipment_update','Shipment update: ' || status_label,
      coalesce(new.courier_name, 'Courier') || ' · ' || coalesce(new.awb_number, 'AWB pending'),
      '/buyer-dashboard?tab=tracking&order=' || order_uuid,
      'shipment',order_uuid,
      'shipment:' || new.id || ':' || coalesce(new.status, 'pending') || ':' || coalesce(new.awb_number, ''),
      jsonb_build_object('shipmentId', new.id, 'status', new.status, 'awb', new.awb_number, 'courier', new.courier_name)
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists shipment_notifications_trigger on public.seller_shipments;
create trigger shipment_notifications_trigger
after insert or update of status, awb_number
on public.seller_shipments
for each row execute function public.emit_shipment_notifications();

insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
select sp.user_id,'seller','new_order','New order request',
       p.name || ' · ' || cor.quantity || ' ' || cor.unit || ' · ₹' || to_char(cor.total_amount,'FM999999990.00'),
       '/seller-dashboard?tab=orders&order=' || cor.id,'catalog_order',cor.id,
       'catalog:' || cor.id || ':new_order',
       jsonb_build_object('productName',p.name,'quantity',cor.quantity,'unit',cor.unit,'totalAmount',cor.total_amount)
from public.catalog_order_requests cor
join public.seller_profiles sp on sp.id=cor.seller_id
join public.seller_products p on p.id=cor.product_id
where cor.status='pending'
on conflict (dedupe_key) do nothing;

insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
select cor.buyer_id,'buyer','order_accepted','Seller accepted your order',
       p.name || ' is ready for payment · ₹' || to_char(cor.total_amount,'FM999999990.00'),
       '/buyer-dashboard?tab=orders&order=' || cor.id,'catalog_order',cor.id,
       'catalog:' || cor.id || ':accepted',
       jsonb_build_object('productName',p.name,'totalAmount',cor.total_amount)
from public.catalog_order_requests cor
join public.seller_products p on p.id=cor.product_id
where cor.status='accepted' and cor.payment_status in ('unpaid','partial','failed')
on conflict (dedupe_key) do nothing;
