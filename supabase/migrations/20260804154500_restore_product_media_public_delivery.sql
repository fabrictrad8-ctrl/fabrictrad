update storage.buckets
set public = true
where id = 'seller-product-media';

drop policy if exists "authenticated_read_seller_product_media" on storage.objects;
