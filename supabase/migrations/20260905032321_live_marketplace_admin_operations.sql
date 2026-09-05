
-- A paginated operations view. Only server routes with an active admin session
-- may query it; it is never exposed to buyer/seller sessions.
create view public.admin_marketplace_orders with (security_invoker=true) as
with order_rows as (
  select o.id,'catalog'::text kind,o.buyer_id,o.seller_id,o.status,o.payment_status,
    o.total_amount amount,o.amount_paid,o.amount_refunded,o.created_at,o.updated_at,o.notes,
    coalesce(p.name,'Removed product') product,coalesce(v.color_name,'') variant,
    o.quantity::text||' '||o.unit qty
  from public.catalog_order_requests o left join public.seller_products p on p.id=o.product_id
    left join public.seller_product_variants v on v.id=o.variant_id
  union all
  select o.id,'bulk',o.buyer_id,o.seller_id,o.status,o.payment_status,
    o.net_total,o.amount_paid,o.amount_refunded,o.created_at,o.updated_at,o.notes,
    coalesce((select string_agg(i.product_name,', ' order by i.id) from public.bulk_order_items i where i.bulk_order_id=o.id),'Bulk order'),
    '',coalesce((select sum(i.quantity_mtrs)::text||' mtr' from public.bulk_order_items i where i.bulk_order_id=o.id),'0 mtr')
  from public.bulk_orders o
)
select o.id,o.kind,'FT-'||upper(o.kind)||'-'||upper(left(o.id::text,8)) reference,
  coalesce(b.full_name,b.email,'Buyer') buyer,b.email buyer_email,
  coalesce(s.display_name,s.legal_business_name,'Seller') seller,s.contact_email seller_email,
  o.product,o.variant,o.qty,o.amount,o.status,o.payment_status,o.created_at,o.updated_at,
  coalesce(p.commission,0) commission,
  lower(concat_ws(' ',o.id,'FT-'||upper(o.kind)||'-'||upper(left(o.id::text,8)),b.full_name,b.email,
    s.display_name,s.legal_business_name,o.product,o.variant)) search_text,
  sh.id is not null has_shipment,
  jsonb_build_object('buyerId',o.buyer_id,'sellerId',o.seller_id,'notes',o.notes,
    'paid',o.amount_paid,'refunded',o.amount_refunded,
    'payments',coalesce(p.records,'[]'::jsonb),
    'shipment',case when sh.id is null then null else jsonb_build_object('id',sh.id,'provider',sh.courier_name,
      'type',sh.courier_type,'awb',sh.awb_number,'trackingUrl',sh.tracking_url,'status',sh.status,'estimatedDelivery',sh.estimated_delivery) end,
    'invoices',coalesce(inv.records,'[]'::jsonb)) details
from order_rows o
left join public.user_profiles b on b.id=o.buyer_id
left join public.seller_profiles s on s.id=o.seller_id
left join public.seller_shipments sh on (o.kind='catalog' and sh.catalog_order_id=o.id) or (o.kind='bulk' and sh.bulk_order_id=o.id)
left join lateral(
  select sum(p.platform_commission) filter(where p.status in ('captured','partially_refunded','refunded')) commission,
    jsonb_agg(jsonb_build_object('id',p.razorpay_payment_id,'status',p.status,'amount',p.amount,
      'refunded',p.refunded_amount,'commission',p.platform_commission,'sellerPayable',p.seller_payable,
      'transferId',p.razorpay_transfer_id,'transferStatus',p.transfer_status,'capturedAt',p.captured_at) order by p.created_at desc) records
  from (
    select status,amount,refunded_amount,platform_commission,seller_payable,razorpay_payment_id,razorpay_transfer_id,transfer_status,captured_at,created_at
    from public.catalog_order_payments where o.kind='catalog' and catalog_order_id=o.id
    union all
    select status,amount,refunded_amount,platform_commission,seller_payable,razorpay_payment_id,razorpay_transfer_id,transfer_status,captured_at,created_at
    from public.bulk_order_payments where o.kind='bulk' and bulk_order_id=o.id
  ) p
) p on true
left join lateral(
  select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'emailStatus',i.email_status,
    'emailRecipient',i.email_recipient,'emailError',i.email_last_error) order by i.issued_at) records
  from public.seller_tax_invoices i where (o.kind='catalog' and i.catalog_order_id=o.id) or (o.kind='bulk' and i.bulk_order_id=o.id)
) inv on true;
revoke all on public.admin_marketplace_orders from public,anon,authenticated;
grant select on public.admin_marketplace_orders to service_role;

create or replace function public.admin_marketplace_totals(p_start timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ACCESS_REQUIRED'; end if;
  with marketplace_orders as (
    select id,status,created_at from public.catalog_order_requests
    union all select id,status,created_at from public.bulk_orders
    union all select id,stage,created_at from public.bespoke_orders
    union all select o.id,o.status,o.created_at from public.orders o
      where not exists(select 1 from public.catalog_order_requests c where c.id=o.id)
        and not exists(select 1 from public.bulk_orders b where b.id=o.id)
        and not exists(select 1 from public.bespoke_orders b where b.id=o.id)
  ), primary_payments as (
    select status,amount,platform_commission,razorpay_payment_id,captured_at,created_at from public.catalog_order_payments
    union all select status,amount,platform_commission,razorpay_payment_id,captured_at,created_at from public.bulk_order_payments
    union all select status,amount,0,razorpay_payment_id,captured_at,created_at from public.bespoke_payments
  ), all_payments as (
    select * from primary_payments
    union all select p.status,p.amount,0,p.razorpay_payment_id,p.captured_at,p.created_at from public.payments p
      where p.razorpay_payment_id is null or not exists(select 1 from primary_payments m where m.razorpay_payment_id=p.razorpay_payment_id)
  )
  select jsonb_build_object(
    'orders',(select count(*) from marketplace_orders where created_at>=p_start),
    'gmv',(select coalesce(sum(amount),0) from all_payments where status in ('captured','partially_refunded','refunded') and coalesce(captured_at,created_at)>=p_start),
    'commission',(select coalesce(sum(platform_commission),0) from all_payments where status in ('captured','partially_refunded','refunded') and coalesce(captured_at,created_at)>=p_start),
    'failedPayments',(select count(*) from all_payments where status='failed' and created_at>=p_start),
    'registrations',(select count(*) from public.user_profiles where created_at>=p_start),
    'sellerApplications',(select count(*) from public.seller_profiles where created_at>=p_start),
    'listings',(select count(*) from public.seller_products where created_at>=p_start),
    'orderStatus',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from marketplace_orders where created_at>=p_start group by status) counts),
    'pendingSellers',(select count(*) from public.seller_profiles where verification_status in ('pending','under_review','submitted')),
    'pendingProducts',(select count(*) from public.seller_products where approval_status in ('pending','pending_review','submitted','draft')),
    'shipmentExceptions',(select count(*) from public.seller_shipments where status='failed'),
    'openDisputes',(select count(*) from public.disputes where status not in ('resolved','closed','cancelled')),
    'unresolvedErrors',(select count(*) from public.error_logs where resolved is not true),
    'invoiceEmailsPending',(select count(*) from public.seller_tax_invoices where email_status<>'sent'),
    'whatsappFailures',(select count(*) from public.seller_whatsapp_jobs where status='failed'),
    'sellersMissingPayoutAccount',(select count(*) from public.seller_profiles where is_active and settlement_eligible and nullif(razorpay_linked_account_id,'') is null),
    'activeProducts',(select count(*) from public.seller_products where status='active' and approval_status='approved'),
    'lowStockProducts',(select count(*) from public.seller_products where available_quantity>0 and available_quantity<=10),
    'outOfStockProducts',(select count(*) from public.seller_products where available_quantity<=0)
  ) into answer;
  return answer;
end;
$$;
revoke all on function public.admin_marketplace_totals(timestamptz) from public,anon,authenticated;
grant execute on function public.admin_marketplace_totals(timestamptz) to service_role;
