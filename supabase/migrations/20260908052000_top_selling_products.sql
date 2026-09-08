create or replace function public.top_selling_products(p_limit integer default 8, p_days integer default 90)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  answer jsonb;
  days_clamped integer := greatest(1, least(coalesce(p_days, 90), 365));
  limit_clamped integer := greatest(1, least(coalesce(p_limit, 8), 24));
  p_start timestamptz := now() - (days_clamped || ' days')::interval;
begin
  with sold as (
    select product_id, sum(quantity) as units_sold, count(*) as order_count
    from public.catalog_order_requests
    where payment_status = 'paid' and product_id is not null and created_at >= p_start
    group by product_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sp.id,
    'name', sp.name,
    'category', sp.category,
    'price', sp.price_per_unit,
    'compareAtPrice', sp.compare_at_price,
    'unit', sp.unit,
    'image', sp.image_url,
    'sellerId', sp.seller_id,
    'unitsSold', sold.units_sold,
    'orderCount', sold.order_count
  ) order by sold.units_sold desc), '[]'::jsonb)
  into answer
  from sold
  join public.seller_products sp on sp.id = sold.product_id
  where sp.status = 'active' and sp.approval_status = 'approved' and sp.available_quantity > 0
  limit limit_clamped;

  return answer;
end;
$function$;

grant execute on function public.top_selling_products(integer, integer) to anon, authenticated;
