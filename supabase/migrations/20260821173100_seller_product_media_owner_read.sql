-- Supabase Storage upserts require SELECT as well as INSERT/UPDATE permissions.
-- Sellers already own their product-media paths by auth.uid(); allow them to
-- read the corresponding storage metadata so draft/publish media upserts pass RLS.
drop policy if exists seller_product_media_owner_read on storage.objects;
create policy seller_product_media_owner_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'seller-product-media'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
  )
);
