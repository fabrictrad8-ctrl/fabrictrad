-- Seller-owned, per-order manual shipping. No direct shipment write grant.
create or replace function public.save_my_manual_shipment(
  p_order_id uuid, p_order_kind text, p_courier_name text, p_awb_number text,
  p_tracking_url text, p_estimated_delivery date, p_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  seller uuid;
  buyer uuid;
  order_seller uuid;
  order_status text;
  payment_state text;
  total numeric;
  net_paid numeric;
  previous public.seller_shipments%rowtype;
  saved public.seller_shipments%rowtype;
begin
  if actor is null then raise exception 'SELLER_ACCESS_REQUIRED'; end if;
  select s.id into seller from public.seller_profiles s
    join public.user_profiles u on u.id=s.user_id
    where s.user_id=actor and s.is_active is true and u.is_active is true and u.can_sell is true;
  if seller is null then raise exception 'SELLER_ACCESS_REQUIRED'; end if;
  if p_order_kind='catalog' then
    select o.buyer_id,o.seller_id,o.status,o.payment_status,o.total_amount,
      coalesce(o.amount_paid,0)-coalesce(o.amount_refunded,0)
      into buyer,order_seller,order_status,payment_state,total,net_paid
      from public.catalog_order_requests o where o.id=p_order_id for update;
  elsif p_order_kind='bulk' then
    select o.buyer_id,o.seller_id,o.status,o.payment_status,o.net_total,
      coalesce(o.amount_paid,0)-coalesce(o.amount_refunded,0)
      into buyer,order_seller,order_status,payment_state,total,net_paid
      from public.bulk_orders o where o.id=p_order_id for update;
  else raise exception 'ORDER_NOT_AVAILABLE'; end if;
  if buyer is null or order_seller is distinct from seller then raise exception 'ORDER_NOT_AVAILABLE'; end if;
  if payment_state is distinct from 'paid' or total <= 0 or net_paid < total
    or order_status not in ('paid','shipped','delivered','fulfilled') then
    raise exception 'FULL_PAYMENT_REQUIRED';
  end if;
  if p_status is null or p_status not in ('pending','in_transit','out_for_delivery','delivered')
    or length(trim(coalesce(p_courier_name,''))) not between 1 and 160
    or length(trim(coalesce(p_awb_number,''))) not between 1 and 160
    or length(coalesce(p_tracking_url,'')) > 2048
    or coalesce(p_tracking_url,'') !~ '^https://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+([/:?#][^[:space:]]*)?$' then
    raise exception 'INVALID_SHIPMENT_DETAILS';
  end if;
  select * into previous from public.seller_shipments s
    where (p_order_kind='catalog' and s.catalog_order_id=p_order_id)
       or (p_order_kind='bulk' and s.bulk_order_id=p_order_id) for update;
  if previous.id is not null and previous.seller_id is distinct from seller then raise exception 'ORDER_NOT_AVAILABLE'; end if;
  if previous.courier_type='shiprocket' then raise exception 'SHIPMENT_ALREADY_BOOKED'; end if;
  if previous.status='delivered' then raise exception 'DELIVERED_SHIPMENT_LOCKED'; end if;
  if p_status='delivered' and (previous.id is null or previous.status not in ('in_transit','out_for_delivery','picked_up')) then
    raise exception 'Mark the shipment in transit before confirming delivery';
  end if;
  if p_status='pending' and previous.status in ('in_transit','out_for_delivery','picked_up') then
    raise exception 'A dispatched shipment cannot return to pending';
  end if;
  if previous.id is null then
    insert into public.seller_shipments(order_id,seller_id,buyer_id,bulk_order_id,catalog_order_id,
      courier_type,courier_name,awb_number,tracking_url,estimated_delivery,status)
    values(p_order_id::text,seller,buyer,
      case when p_order_kind='bulk' then p_order_id end,
      case when p_order_kind='catalog' then p_order_id end,
      'local',trim(p_courier_name),trim(p_awb_number),trim(p_tracking_url),p_estimated_delivery,p_status)
    returning * into saved;
  else
    update public.seller_shipments set courier_name=trim(p_courier_name),awb_number=trim(p_awb_number),
      tracking_url=trim(p_tracking_url),estimated_delivery=p_estimated_delivery,status=p_status,updated_at=now()
      where id=previous.id returning * into saved;
  end if;
  if p_order_kind='bulk' and p_status<>'pending' and order_status='paid' then
    update public.bulk_orders set status='shipped',updated_at=now() where id=p_order_id;
    order_status := 'shipped';
  end if;
  if p_status='delivered' then
    if p_order_kind='bulk' and order_status='shipped' then
      update public.bulk_orders set status='delivered',updated_at=now() where id=p_order_id;
    elsif p_order_kind='catalog' and order_status='paid' then
      update public.catalog_order_requests set status='fulfilled',fulfilled_at=now(),updated_at=now() where id=p_order_id;
    end if;
  end if;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_my_manual_shipment(uuid,text,text,text,text,date,text) from public,anon;
grant execute on function public.save_my_manual_shipment(uuid,text,text,text,text,date,text) to authenticated;

drop policy if exists sellers_read_own_bulk_orders on public.bulk_orders;
create policy sellers_read_own_bulk_orders on public.bulk_orders for select to authenticated
  using (seller_id=public.my_seller_id() and public.can_current_user_sell());
drop policy if exists admins_read_bulk_orders on public.bulk_orders;
create policy admins_read_bulk_orders on public.bulk_orders for select to authenticated using(public.is_admin());

create or replace function public.emit_shipment_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
declare order_uuid uuid := coalesce(new.catalog_order_id,new.bulk_order_id);
begin
  if new.buyer_id is null or order_uuid is null then return new; end if;
  if tg_op='INSERT' or new.status is distinct from old.status or new.awb_number is distinct from old.awb_number
    or new.courier_name is distinct from old.courier_name or new.tracking_url is distinct from old.tracking_url then
    insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
    values(new.buyer_id,'buyer','shipment_update','Shipment: ' || initcap(replace(new.status,'_',' ')),
      coalesce(new.courier_name,'Courier') || ' · AWB ' || coalesce(new.awb_number,'pending'),
      '/buyer-dashboard?tab=tracking&order=' || order_uuid,'shipment',order_uuid,
      'shipment:' || new.id || ':' || md5(concat_ws('|',new.status,new.awb_number,new.courier_name,new.tracking_url)),
      jsonb_build_object('shipmentId',new.id,'status',new.status,'awb',new.awb_number,'courier',new.courier_name,'trackingUrl',new.tracking_url))
    on conflict(dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.emit_shipment_notifications() from public,anon,authenticated;
drop trigger if exists shipment_notifications_trigger on public.seller_shipments;
create trigger shipment_notifications_trigger after insert or update of status,awb_number,courier_name,tracking_url
  on public.seller_shipments for each row execute function public.emit_shipment_notifications();

-- Browser users may make order decisions, but may never forge money fields.
create or replace function public.protect_catalog_payment_fields() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.role()='service_role' or public.is_admin() then return new; end if;
  if tg_op='INSERT' then
    if coalesce(new.amount_paid,0)<>0 or coalesce(new.amount_refunded,0)<>0
      or coalesce(new.payment_status,'unpaid')<>'unpaid' or new.paid_at is not null then
      raise exception 'New orders must start unpaid';
    end if;
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status
    or new.amount_paid is distinct from old.amount_paid
    or new.amount_refunded is distinct from old.amount_refunded
    or new.paid_at is distinct from old.paid_at
    or new.gst_rate is distinct from old.gst_rate
    or new.company_id is distinct from old.company_id
    or new.price_includes_gst is distinct from old.price_includes_gst
    or new.hsn_code is distinct from old.hsn_code
    or new.cgst_amount is distinct from old.cgst_amount
    or new.sgst_amount is distinct from old.sgst_amount
    or new.igst_amount is distinct from old.igst_amount
    or new.tax_invoice_type is distinct from old.tax_invoice_type
    or new.seller_gstin is distinct from old.seller_gstin
    or new.seller_gstin_verified is distinct from old.seller_gstin_verified
    or new.buyer_gstin is distinct from old.buyer_gstin
    or new.buyer_gstin_verified is distinct from old.buyer_gstin_verified
    or new.place_of_supply_state is distinct from old.place_of_supply_state
    or new.intra_state_supply is distinct from old.intra_state_supply
    or new.input_tax_credit_possible is distinct from old.input_tax_credit_possible then
    raise exception 'Payment and tax fields are managed by the payment service';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_catalog_payment_fields() from public,anon,authenticated;
create trigger protect_catalog_payment_fields_trigger before insert or update on public.catalog_order_requests
  for each row execute function public.protect_catalog_payment_fields();

-- Order prices/tax are snapshots. Payment and fulfilment updates must neither
-- reprice the order nor compare its already-reserved quantity to remaining stock.
drop trigger catalog_order_policy_and_tax on public.catalog_order_requests;
create trigger catalog_order_policy_and_tax before insert on public.catalog_order_requests
  for each row execute function public.enforce_catalog_order_policy_and_tax();
drop trigger zz_catalog_order_india_gst on public.catalog_order_requests;
create trigger zz_catalog_order_india_gst before insert on public.catalog_order_requests
  for each row execute function public.apply_catalog_order_india_gst();

-- Retain the newer, idempotent release trigger; the legacy AFTER trigger
-- otherwise adds a cancelled order's quantity to stock a second time.
drop trigger restore_catalog_order_stock_on_cancel_trigger on public.catalog_order_requests;
-- All buyer order creation uses the ownership-checked submission RPC.
drop policy buyers_create_catalog_order_requests on public.catalog_order_requests;

drop policy "Buyers manage own bulk orders" on public.bulk_orders;
create policy buyers_read_own_bulk_orders on public.bulk_orders for select to authenticated
  using(buyer_id=auth.uid() and public.can_current_user_buy());
create policy buyers_cancel_unpaid_bulk_orders on public.bulk_orders for update to authenticated
  using(buyer_id=auth.uid() and public.can_current_user_buy() and amount_paid=0 and status in ('draft','quote_sent','confirmed'))
  with check(buyer_id=auth.uid() and status='cancelled' and amount_paid=0);

-- All capture paths, including retries and delayed webhooks, share this guard.
create or replace function public.protect_marketplace_payment_progress() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.amount is distinct from old.amount or new.currency is distinct from old.currency
    or new.razorpay_order_id is distinct from old.razorpay_order_id then
    raise exception 'Stored payment amount, currency and order reference are immutable';
  end if;
  if old.status in ('captured','partially_refunded','refunded') then
    if new.status in ('captured','partially_refunded','refunded')
       and old.razorpay_payment_id is not null
       and new.razorpay_payment_id is distinct from old.razorpay_payment_id then
      raise exception 'A captured payment reference cannot be replaced';
    end if;
    new.razorpay_payment_id := old.razorpay_payment_id;
    new.captured_at := old.captured_at;
    new.captured_amount := old.captured_amount;
    if new.status not in ('captured','partially_refunded','refunded') then
      new.status := old.status;
      new.failure_reason := old.failure_reason;
      new.payment_method := old.payment_method;
      new.razorpay_fee_actual := old.razorpay_fee_actual;
      new.razorpay_tax_actual := old.razorpay_tax_actual;
    end if;
  end if;
  new.refunded_amount := greatest(coalesce(old.refunded_amount,0),coalesce(new.refunded_amount,0));
  if new.refunded_amount > 0 then
    new.status := case when new.refunded_amount >= new.amount then 'refunded' else 'partially_refunded' end;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_marketplace_payment_progress() from public,anon,authenticated;
create trigger protect_catalog_payment_progress before update on public.catalog_order_payments
  for each row execute function public.protect_marketplace_payment_progress();
create trigger protect_bulk_payment_progress before update on public.bulk_order_payments
  for each row execute function public.protect_marketplace_payment_progress();

-- Lock the order before reading its complete ledger, avoiding stale concurrent totals.
create or replace function public.reconcile_marketplace_payment(p_kind text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  order_table text; payment_table text; order_key text;
  o jsonb; captured numeric; refunded numeric; total numeric; net_paid numeric;
  payment_state text; next_state text; gst numeric; gst_rate numeric; taxable numeric;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ACCESS_REQUIRED'; end if;
  if p_kind='catalog' then
    order_table:='catalog_order_requests'; payment_table:='catalog_order_payments'; order_key:='catalog_order_id';
  elsif p_kind='bulk' then
    order_table:='bulk_orders'; payment_table:='bulk_order_payments'; order_key:='bulk_order_id';
  else raise exception 'INVALID_ORDER_KIND'; end if;
  execute format('select to_jsonb(o) from public.%I o where id=$1 for update',order_table) into o using p_order_id;
  if o is null then raise exception 'ORDER_NOT_FOUND'; end if;
  execute format('select coalesce(sum(amount) filter(where status in (''captured'',''partially_refunded'',''refunded'')),0),
    coalesce(sum(refunded_amount),0) from public.%I where %I=$1',payment_table,order_key)
    into captured,refunded using p_order_id;
  total := coalesce((case when p_kind='catalog' then o->>'total_amount' else o->>'net_total' end)::numeric,0);
  net_paid := greatest(0,captured-refunded);
  payment_state := case when captured>0 and refunded>=captured then 'refunded'
    when refunded>0 then 'partially_refunded'
    when total>0 and net_paid>=total then 'paid' when net_paid>0 then 'partial' else 'unpaid' end;
  next_state := o->>'status';
  if payment_state='paid' and next_state in ('pending','accepted','draft','quote_sent','confirmed') then next_state:='paid'; end if;
  execute format('update public.%I set amount_paid=$2,amount_refunded=$3,payment_status=$4,status=$5,updated_at=now() where id=$1',order_table)
    using p_order_id,captured,refunded,payment_state,next_state;
  if p_kind='catalog' and payment_state='paid' then
    update public.catalog_order_requests set paid_at=coalesce(paid_at,now()) where id=p_order_id;
  end if;
  gst := coalesce((case when p_kind='catalog' then o->>'gst_amount' else o->>'gst_total' end)::numeric,0);
  taxable := greatest(total-gst,0);
  gst_rate := case when p_kind='catalog' then coalesce((o->>'gst_rate')::numeric,0)
    when taxable>0 then round(gst/taxable*100,2) else 0 end;
  return jsonb_build_object('paymentStatus',payment_state,'amountPaid',captured,'amountRefunded',refunded,
    'captured',captured,'refunded',refunded,'order',o,'gstAmount',gst,'effectiveGstRate',gst_rate,
    'needsReview',payment_state='paid' and next_state in ('cancelled','rejected'));
end;
$$;
revoke all on function public.reconcile_marketplace_payment(text,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_marketplace_payment(text,uuid) to service_role;

-- Refund IDs, not delivery event IDs, identify the financial operation.
create table public.marketplace_refund_events(
  refund_id text primary key,
  kind text not null check(kind in ('catalog','bulk')),
  payment_id uuid not null,
  amount numeric(12,2) not null check(amount>0),
  status text not null check(status in ('created','processed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketplace_refund_events enable row level security;
create policy admins_read_marketplace_refunds on public.marketplace_refund_events
  for select to authenticated using(public.is_admin());
grant select on public.marketplace_refund_events to authenticated;
grant all on public.marketplace_refund_events to service_role;
create index marketplace_refund_events_payment_idx on public.marketplace_refund_events(kind,payment_id);
create or replace function public.record_marketplace_refund(
  p_kind text,p_payment_id uuid,p_refund_id text,p_amount numeric,p_status text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  payment_table text; p jsonb; prior public.marketplace_refund_events%rowtype;
  next_refunded numeric; delta numeric:=0;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ACCESS_REQUIRED'; end if;
  if p_kind='catalog' then payment_table:='catalog_order_payments';
  elsif p_kind='bulk' then payment_table:='bulk_order_payments';
  else raise exception 'INVALID_ORDER_KIND'; end if;
  if p_status not in ('created','processed','failed') or p_status is null or p_amount<=0 or p_amount is null
    or length(coalesce(p_refund_id,'')) not between 1 and 160 then raise exception 'INVALID_REFUND'; end if;
  execute format('select to_jsonb(p) from public.%I p where id=$1 for update',payment_table) into p using p_payment_id;
  if p is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  select * into prior from public.marketplace_refund_events where refund_id=p_refund_id for update;
  if prior.refund_id is not null then
    if prior.kind<>p_kind or prior.payment_id<>p_payment_id or prior.amount<>p_amount then raise exception 'REFUND_REFERENCE_MISMATCH'; end if;
    if prior.status='processed' then return p; end if;
  end if;
  if p_amount>(p->>'amount')::numeric then raise exception 'REFUND_EXCEEDS_PAYMENT'; end if;
  if p_status='processed' then delta:=p_amount; end if;
  next_refunded:=coalesce((p->>'refunded_amount')::numeric,0)+delta;
  if next_refunded>(p->>'amount')::numeric then raise exception 'REFUND_EXCEEDS_BALANCE'; end if;
  insert into public.marketplace_refund_events(refund_id,kind,payment_id,amount,status)
    values(p_refund_id,p_kind,p_payment_id,p_amount,p_status)
    on conflict(refund_id) do update set status=excluded.status,updated_at=now();
  execute format('update public.%I set refunded_amount=$2,refund_status=$3,
    refund_requested_amount=$4,last_refund_request_id=$5,last_webhook_event=$6,
    last_webhook_at=now(),updated_at=now() where id=$1 returning to_jsonb(%I.*)',payment_table,payment_table)
    into p using p_payment_id,next_refunded,
      case when p_status='created' then 'requested' else p_status end,
      case when p_status='created' then p_amount else 0 end,p_refund_id,'refund.'||p_status;
  return p;
end;
$$;
revoke all on function public.record_marketplace_refund(text,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_marketplace_refund(text,uuid,text,numeric,text) to service_role;

-- Store inbound messages before acknowledging the provider; retry failed leases.
create table public.seller_whatsapp_jobs(
  message_id text primary key, sender text not null, payload jsonb not null,
  status text not null default 'queued' check(status in ('queued','processing','completed','failed')),
  attempts integer not null default 0, last_error text, locked_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.seller_whatsapp_jobs enable row level security;
grant all on public.seller_whatsapp_jobs to service_role;
grant select on public.seller_whatsapp_jobs to authenticated;
create policy admins_read_seller_whatsapp_jobs on public.seller_whatsapp_jobs
  for select to authenticated using(public.is_admin());
create index seller_whatsapp_jobs_due_idx on public.seller_whatsapp_jobs(next_attempt_at,created_at) where status<>'completed';
create index seller_whatsapp_jobs_sender_idx on public.seller_whatsapp_jobs(sender,created_at);
create or replace function public.claim_seller_whatsapp_job(p_message_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.seller_whatsapp_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ACCESS_REQUIRED'; end if;
  select * into job from public.seller_whatsapp_jobs j
  where (p_message_id is null or j.message_id=p_message_id) and j.status<>'completed' and j.attempts<5
    and j.next_attempt_at<=now() and (j.locked_until is null or j.locked_until<now())
    and not exists(select 1 from public.seller_whatsapp_jobs earlier
      where earlier.sender=j.sender and earlier.message_id<>j.message_id and earlier.status<>'completed' and earlier.attempts<5
      and (earlier.created_at<j.created_at or earlier.locked_until>now()))
  order by j.created_at for update skip locked limit 1;
  if job.message_id is null then return null; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(job.sender,0)) then return null; end if;
  update public.seller_whatsapp_jobs set status='processing',attempts=attempts+1,
    locked_until=now()+interval '3 minutes',updated_at=now() where message_id=job.message_id returning * into job;
  return to_jsonb(job);
end;
$$;
revoke all on function public.claim_seller_whatsapp_job(text) from public,anon,authenticated;
grant execute on function public.claim_seller_whatsapp_job(text) to service_role;

create policy sellers_update_own_bulk_orders on public.bulk_orders for update to authenticated
  using(seller_id=public.my_seller_id() and public.can_current_user_sell())
  with check(seller_id=public.my_seller_id() and public.can_current_user_sell());
create or replace function public.require_bulk_shipment_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.role()='service_role' or public.is_admin() or new.status=old.status then return new; end if;
  if new.status='shipped' and not exists(select 1 from public.seller_shipments s
    where s.bulk_order_id=old.id and s.seller_id=old.seller_id and length(trim(s.awb_number))>0 and s.tracking_url like 'https://%') then
    raise exception 'Shipment AWB and tracking link are required before dispatch';
  end if;
  if new.status='delivered' and not exists(select 1 from public.seller_shipments s
    where s.bulk_order_id=old.id and s.seller_id=old.seller_id and s.status='delivered') then
    raise exception 'Shipment must be delivered before completing this order';
  end if;
  return new;
end;
$$;
revoke all on function public.require_bulk_shipment_evidence() from public,anon,authenticated;
create trigger require_bulk_shipment_evidence before update on public.bulk_orders
  for each row execute function public.require_bulk_shipment_evidence();

CREATE OR REPLACE FUNCTION public.submit_catalog_order_request(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_company_id uuid DEFAULT NULL::uuid, p_company_location_id uuid DEFAULT NULL::uuid, p_purchase_order_number text DEFAULT NULL::text, p_payment_terms text DEFAULT 'due_on_order'::text, p_deposit_percent numeric DEFAULT 0, p_requires_review boolean DEFAULT false, p_notes text DEFAULT NULL::text)
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

  -- Deduplicate concurrent clicks from the same buyer before checking reusable orders.
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

  -- Serialize buyers competing for the same physical stock before authoritative pricing/tax trigger runs.
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
    'invoiceType',created.tax_invoice_type,'inputTaxCreditPossible',created.input_tax_credit_possible,
    'taxNote',created.tax_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_company_catalog_order(p_order_id uuid, p_decision text)
 RETURNS catalog_order_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_row public.catalog_order_requests%rowtype;
  due_at timestamptz;
begin
  if p_decision not in ('approve','reject') then raise exception 'Unsupported review decision'; end if;
  select request.* into request_row
  from public.catalog_order_requests request
  join public.b2b_company_accounts company on company.id=request.company_id
  where request.id=p_order_id and request.buyer_id=auth.uid() and company.owner_user_id=auth.uid()
  for update of request;
  if not found then raise exception 'Order request not found'; end if;
  if not request_row.requires_review then raise exception 'This order does not require company review'; end if;
  if request_row.status <> 'pending' or request_row.review_status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  if request_row.variant_id is not null then
    perform 1 from public.seller_product_variants where id=request_row.variant_id and product_id=request_row.product_id and seller_id=request_row.seller_id for update;
  else
    perform 1 from public.seller_products where id=request_row.product_id and seller_id=request_row.seller_id for update;
  end if;

  if p_decision='reject' then
    -- The common cancellation trigger releases this reservation exactly once.
    update public.catalog_order_requests
      set review_status='rejected',status='cancelled',notes=concat_ws(E'\n',nullif(notes,''),'Company review: rejected.'),updated_at=now()
      where id=p_order_id returning * into request_row;
    return request_row;
  end if;

  due_at := case request_row.payment_terms
    when 'due_on_fulfillment' then null when 'net_7' then now()+interval '7 days'
    when 'net_15' then now()+interval '15 days' when 'net_30' then now()+interval '30 days'
    when 'net_45' then now()+interval '45 days' when 'net_60' then now()+interval '60 days'
    when 'net_90' then now()+interval '90 days' else now()+interval '48 hours' end;

  if request_row.variant_id is not null then
    update public.seller_product_variants
      set available_quantity=available_quantity-request_row.quantity,
          reserved_quantity=greatest(coalesce(reserved_quantity,0)-request_row.quantity,0),updated_at=now()
      where id=request_row.variant_id and reserved_quantity >= request_row.quantity;
    if not found then raise exception 'Reserved stock is no longer available'; end if;
  else
    update public.seller_products
      set available_quantity=available_quantity-request_row.quantity,
          reserved_quantity=greatest(coalesce(reserved_quantity,0)-request_row.quantity,0),updated_at=now()
      where id=request_row.product_id and reserved_quantity >= request_row.quantity;
    if not found then raise exception 'Reserved stock is no longer available'; end if;
  end if;

  update public.catalog_order_requests
    set review_status='approved',status='accepted',payment_due_at=due_at,
        notes=concat_ws(E'\n',nullif(notes,''),'Company review: approved. Stock confirmed automatically.'),updated_at=now()
    where id=p_order_id returning * into request_row;
  return request_row;
end;
$function$;


create or replace function public.release_catalog_order_stock_on_terminal_cancel()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status in ('pending','accepted','paid') and new.status in ('cancelled','rejected')
    and old.stock_released_at is null then
    if old.status='pending' then
      if old.variant_id is not null then
        update public.seller_product_variants set reserved_quantity=greatest(coalesce(reserved_quantity,0)-old.quantity,0),updated_at=now()
          where id=old.variant_id and product_id=old.product_id and seller_id=old.seller_id;
      else
        update public.seller_products set reserved_quantity=greatest(coalesce(reserved_quantity,0)-old.quantity,0),updated_at=now()
          where id=old.product_id and seller_id=old.seller_id;
      end if;
    elsif old.variant_id is not null then
      update public.seller_product_variants set available_quantity=available_quantity+old.quantity,updated_at=now()
        where id=old.variant_id and product_id=old.product_id and seller_id=old.seller_id;
    else
      update public.seller_products set available_quantity=available_quantity+old.quantity,updated_at=now()
        where id=old.product_id and seller_id=old.seller_id;
    end if;
    new.stock_released_at:=now();
  end if;
  return new;
end;
$$;

create or replace function public.protect_catalog_order_request_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_seller_id uuid;
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.buyer_id is distinct from old.buyer_id
    or new.seller_id is distinct from old.seller_id
    or new.product_id is distinct from old.product_id
    or new.variant_id is distinct from old.variant_id
    or new.quantity is distinct from old.quantity
    or new.unit is distinct from old.unit
    or new.price_per_unit is distinct from old.price_per_unit
    or new.subtotal is distinct from old.subtotal
    or new.gst_amount is distinct from old.gst_amount
    or new.total_amount is distinct from old.total_amount then
    raise exception 'Order ownership, products, quantities and totals cannot be changed';
  end if;

  actor_seller_id := public.my_seller_id();
  if actor_seller_id = old.seller_id and public.can_current_user_sell() then
    if new.status is distinct from old.status then
      if old.status in ('pending','accepted') and new.status = 'rejected' and coalesce(old.amount_paid,0)=0 then
        return new;
      end if;
      if old.status = 'paid' and new.status = 'fulfilled' then
        if not exists (
          select 1
          from public.seller_shipments s
          where s.catalog_order_id = old.id
            and s.seller_id = old.seller_id
            and s.status = 'delivered'
        ) then
          raise exception 'This order can only be fulfilled after the shipment is marked delivered';
        end if;
        return new;
      end if;
      raise exception 'Seller is not allowed to set this order status';
    end if;
    return new;
  end if;

  if auth.uid() = old.buyer_id and public.can_current_user_buy() then
    if old.status='pending' and new.status='accepted' and old.requires_review
      and new.review_status='approved' and exists(select 1 from public.b2b_company_accounts c
        where c.id=old.company_id and c.owner_user_id=auth.uid() and c.status='active') then return new; end if;
    if new.status='cancelled' and coalesce(old.amount_paid,0)>coalesce(old.amount_refunded,0) then
      raise exception 'Captured payments must be refunded before cancellation';
    end if;
    if new.status is distinct from old.status
      and not (old.status in ('pending','accepted') and new.status = 'cancelled') then
      raise exception 'Buyer is not allowed to set this order status';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update this order';
end;
$$;
