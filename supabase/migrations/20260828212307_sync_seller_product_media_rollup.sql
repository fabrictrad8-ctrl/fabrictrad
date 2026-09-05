create or replace function public.sync_seller_product_media_rollup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid := coalesce(new.product_id,old.product_id);
  v_primary text;
  v_images jsonb;
begin
  select m.public_url into v_primary
  from public.seller_product_media m
  where m.product_id=v_product_id and m.media_type='image'
  order by case when m.view_type='front' then 0 else 1 end, m.sort_order, m.created_at
  limit 1;

  select coalesce(jsonb_agg(x.public_url order by x.rank_order,x.sort_order,x.created_at),'[]'::jsonb)
    into v_images
  from (
    select m.public_url,m.sort_order,m.created_at,case when m.view_type='front' then 0 else 1 end as rank_order
    from public.seller_product_media m
    where m.product_id=v_product_id and m.media_type='image'
  ) x;

  update public.seller_products
     set image_url=v_primary,
         image_urls=v_images,
         updated_at=now()
   where id=v_product_id;

  return coalesce(new,old);
end;
$$;

drop trigger if exists seller_product_media_rollup on public.seller_product_media;
create trigger seller_product_media_rollup
after insert or update or delete on public.seller_product_media
for each row execute function public.sync_seller_product_media_rollup();

revoke all on function public.sync_seller_product_media_rollup() from public, anon, authenticated;
grant execute on function public.sync_seller_product_media_rollup() to service_role;

-- Backfill existing media into the product rollup without changing business fields.
update public.seller_products p
set image_url = x.primary_url,
    image_urls = x.urls,
    updated_at = now()
from (
  select product_id,
         (array_agg(public_url order by case when view_type='front' then 0 else 1 end, sort_order, created_at))[1] as primary_url,
         jsonb_agg(public_url order by case when view_type='front' then 0 else 1 end, sort_order, created_at) as urls
  from public.seller_product_media
  where media_type='image'
  group by product_id
) x
where p.id=x.product_id;
