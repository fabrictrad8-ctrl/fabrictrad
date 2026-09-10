-- Invoice email status could only describe what FabricTrad did, never what
-- happened to the message afterwards. 'sent' means Resend accepted it for
-- delivery — a mistyped buyer address bounces minutes later and the invoice
-- still reads 'sent' forever, so a buyer who never received their GST document
-- is indistinguishable from one who did.
--
-- These three states come from Resend delivery webhooks:
--
--   delivered   the receiving mail server accepted it. The only status that
--               actually proves the buyer got it.
--   bounced     permanently rejected. Needs a corrected address, not a retry.
--   complained  the recipient marked it as spam. Must never be resent.
--
-- All three are terminal on purpose. retryUndeliveredInvoiceEmails only sweeps
-- pending, failed and not_configured, so none of these are picked up again:
-- re-sending a hard bounce damages domain reputation, and re-sending after a
-- spam complaint is what gets a sending domain blocked outright.

alter table public.seller_tax_invoices
  drop constraint if exists seller_tax_invoices_email_status_check;

alter table public.seller_tax_invoices
  add constraint seller_tax_invoices_email_status_check
  check (email_status = any (array[
    'pending'::text,
    'sending'::text,
    'sent'::text,
    'delivered'::text,
    'bounced'::text,
    'complained'::text,
    'failed'::text,
    'not_configured'::text
  ]));

-- Webhooks arrive keyed by the provider's message id, which is the only link
-- back to the invoice. Without this every delivery event would scan the table.
create index if not exists seller_tax_invoices_email_provider_id_idx
  on public.seller_tax_invoices (email_provider_id)
  where email_provider_id is not null;

comment on column public.seller_tax_invoices.email_status is
  'Delivery state. pending/sending/failed/not_configured are FabricTrad-side and '
  'are retried by the worker cron. sent means the provider accepted the message. '
  'delivered/bounced/complained come from provider webhooks and are terminal.';

-- The admin "Invoice emails needing attention" tile counted anything that was
-- not 'sent'. With delivery outcomes recorded, a successfully delivered invoice
-- would start counting as a problem, and a bounce would stop counting as one
-- the moment it left 'sent' — exactly backwards. Attention means "the buyer
-- does not have this document": everything except sent and delivered.
create or replace function public.admin_marketplace_totals(p_start timestamp with time zone)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare answer jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ACCESS_REQUIRED'; end if;
  with marketplace_orders as (
    select id,status,created_at from public.catalog_order_requests
    union all select id,status,created_at from public.bulk_orders
    union all select id,stage,created_at from public.bespoke_orders
    union all select o.id,o.status::text,o.created_at from public.orders o
      where not exists(select 1 from public.catalog_order_requests c where c.id=o.id)
        and not exists(select 1 from public.bulk_orders b where b.id=o.id)
        and not exists(select 1 from public.bespoke_orders b where b.id=o.id)
  ), primary_payments as (
    select status,amount,platform_commission,razorpay_payment_id,captured_at,created_at from public.catalog_order_payments
    union all select status,amount,platform_commission,razorpay_payment_id,captured_at,created_at from public.bulk_order_payments
    union all select status,amount,0,razorpay_payment_id,captured_at,created_at from public.bespoke_payments
  ), all_payments as (
    select * from primary_payments
    union all select p.status::text,p.amount,0,p.razorpay_payment_id,p.captured_at,p.created_at from public.payments p
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
    'pendingSellers',(select count(*) from public.seller_profiles where verification_status::text in ('pending','under_review','submitted')),
    'pendingProducts',(select count(*) from public.seller_products where approval_status in ('pending','pending_review','submitted','draft')),
    'shipmentExceptions',(select count(*) from public.seller_shipments where status='failed'),
    'openDisputes',(select count(*) from public.disputes where status::text not in ('resolved','closed','cancelled')),
    'unresolvedErrors',(select count(*) from public.error_logs where resolved is not true),
    'invoiceEmailsPending',(select count(*) from public.seller_tax_invoices where email_status not in ('sent','delivered')),
    'whatsappFailures',(select count(*) from public.seller_whatsapp_jobs where status='failed'),
    'sellersMissingPayoutAccount',(select count(*) from public.seller_profiles where is_active and settlement_eligible and nullif(razorpay_linked_account_id,'') is null),
    'activeProducts',(select count(*) from public.seller_products where status='active' and approval_status='approved'),
    'lowStockProducts',(select count(*) from public.seller_products where available_quantity>0 and available_quantity<=10),
    'outOfStockProducts',(select count(*) from public.seller_products where available_quantity<=0)
  ) into answer;
  return answer;
end;
$function$;
