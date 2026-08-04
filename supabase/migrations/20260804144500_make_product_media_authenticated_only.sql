update storage.buckets
set public = false
where id = 'seller-product-media';

drop policy if exists "authenticated_read_seller_product_media" on storage.objects;
create policy "authenticated_read_seller_product_media"
on storage.objects
for select
to authenticated
using (bucket_id = 'seller-product-media');
