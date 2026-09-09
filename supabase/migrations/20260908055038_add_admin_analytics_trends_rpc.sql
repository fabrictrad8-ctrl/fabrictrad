-- Reconstructed from the applied live migration 20260908055038_add_admin_analytics_trends_rpc.
CREATE OR REPLACE FUNCTION public.admin_analytics_trends(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  answer jsonb;
  days_clamped integer := greatest(1, least(coalesce(p_days, 30), 365));
  p_start timestamptz := date_trunc('day', now()) - ((days_clamped - 1) || ' days')::interval;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ACCESS_REQUIRED'; end if;

  with marketplace_orders as (
    select id, status, seller_id, created_at from public.catalog_order_requests
    union all select id, status, seller_id, created_at from public.bulk_orders
    union all select id, stage as status, seller_id, created_at from public.bespoke_orders
    union all select o.id, o.status::text, o.seller_id, o.created_at from public.orders o
      where not exists (select 1 from public.catalog_order_requests c where c.id = o.id)
        and not exists (select 1 from public.bulk_orders b where b.id = o.id)
        and not exists (select 1 from public.bespoke_orders b where b.id = o.id)
  ),
  payments_with_seller as (
    select cp.status, cp.amount, cp.platform_commission, cp.razorpay_payment_id, cp.payment_method, cp.captured_at, cp.created_at, cor.seller_id
    from public.catalog_order_payments cp join public.catalog_order_requests cor on cor.id = cp.catalog_order_id
    union all
    select bp.status, bp.amount, bp.platform_commission, bp.razorpay_payment_id, bp.payment_method, bp.captured_at, bp.created_at, bo.seller_id
    from public.bulk_order_payments bp join public.bulk_orders bo on bo.id = bp.bulk_order_id
    union all
    select bsp.status, bsp.amount, bsp.platform_commission, bsp.razorpay_payment_id, bsp.payment_method, bsp.captured_at, bsp.created_at, bso.seller_id
    from public.bespoke_payments bsp join public.bespoke_orders bso on bso.id = bsp.bespoke_order_id
  ),
  all_payments as (
    select * from payments_with_seller
    union all
    select p.status::text, p.amount, 0::numeric as platform_commission, p.razorpay_payment_id, p.payment_method, p.captured_at, p.created_at, o.seller_id
    from public.payments p
    left join public.orders o on o.id = p.order_id
    where p.razorpay_payment_id is null or not exists (select 1 from payments_with_seller m where m.razorpay_payment_id = p.razorpay_payment_id)
  ),
  captured_payments as (
    select *, coalesce(captured_at, created_at) as counted_at
    from all_payments
    where status in ('captured', 'partially_refunded', 'refunded')
  ),
  day_series as (
    select generate_series(p_start, date_trunc('day', now()), interval '1 day')::date as day
  ),
  daily_orders as (
    select date_trunc('day', created_at)::date as day, count(*) as orders
    from marketplace_orders where created_at >= p_start group by 1
  ),
  daily_gmv as (
    select date_trunc('day', counted_at)::date as day, sum(amount) as gmv, sum(platform_commission) as commission
    from captured_payments where counted_at >= p_start group by 1
  ),
  daily_buyers as (
    select date_trunc('day', created_at)::date as day, count(*) as new_buyers
    from public.user_profiles where created_at >= p_start and role = 'buyer' group by 1
  ),
  daily_sellers as (
    select date_trunc('day', created_at)::date as day, count(*) as new_sellers
    from public.user_profiles where created_at >= p_start and role = 'seller' group by 1
  ),
  series as (
    select jsonb_agg(jsonb_build_object(
      'date', to_char(ds.day, 'YYYY-MM-DD'),
      'orders', coalesce(do_.orders, 0),
      'gmv', coalesce(dg.gmv, 0),
      'commission', coalesce(dg.commission, 0),
      'newBuyers', coalesce(db.new_buyers, 0),
      'newSellers', coalesce(dsl.new_sellers, 0)
    ) order by ds.day) as rows
    from day_series ds
    left join daily_orders do_ on do_.day = ds.day
    left join daily_gmv dg on dg.day = ds.day
    left join daily_buyers db on db.day = ds.day
    left join daily_sellers dsl on dsl.day = ds.day
  ),
  seller_gmv as (
    select seller_id, sum(amount) as gmv, sum(platform_commission) as commission, count(*) as orders
    from captured_payments
    where counted_at >= p_start and seller_id is not null
    group by seller_id
  ),
  top_sellers as (
    select jsonb_agg(jsonb_build_object(
      'sellerId', sp.id,
      'name', coalesce(sp.display_name, sp.legal_business_name, 'Seller'),
      'orders', sg.orders,
      'gmv', sg.gmv,
      'commission', sg.commission
    ) order by sg.gmv desc) as rows
    from seller_gmv sg
    join public.seller_profiles sp on sp.id = sg.seller_id
    where sg.gmv > 0
    limit 8
  ),
  category_rows as (
    select jsonb_agg(jsonb_build_object(
      'category', coalesce(nullif(category, ''), 'Uncategorised'),
      'listings', listings,
      'activeListings', active_listings
    ) order by listings desc) as rows
    from (
      select category, count(*) as listings,
        count(*) filter (where status = 'active' and approval_status = 'approved') as active_listings
      from public.seller_products
      group by category
      order by count(*) desc
      limit 10
    ) cat
  ),
  payment_method_rows as (
    select jsonb_agg(jsonb_build_object(
      'method', coalesce(nullif(payment_method, ''), 'unknown'),
      'count', n,
      'amount', amt
    ) order by amt desc) as rows
    from (
      select payment_method, count(*) as n, sum(amount) as amt
      from captured_payments
      where counted_at >= p_start
      group by payment_method
    ) pm
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'days', days_clamped,
    'rangeStart', p_start,
    'series', coalesce((select rows from series), '[]'::jsonb),
    'topSellers', coalesce((select rows from top_sellers), '[]'::jsonb),
    'categoryMix', coalesce((select rows from category_rows), '[]'::jsonb),
    'paymentMethodMix', coalesce((select rows from payment_method_rows), '[]'::jsonb)
  ) into answer;

  return answer;
end;
$function$;
