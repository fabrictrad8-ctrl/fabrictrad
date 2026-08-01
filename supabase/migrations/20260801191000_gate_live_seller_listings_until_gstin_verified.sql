update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/xml',
  'text/xml',
  'application/zip',
  'application/x-zip-compressed'
]
where id = 'business-kyc-documents';

create or replace function public.require_verified_gstin_for_live_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller public.seller_profiles%rowtype;
begin
  if new.status <> 'active' then return new; end if;
  select * into seller from public.seller_profiles where id = new.seller_id;
  if not found then raise exception 'Seller profile not found'; end if;
  if not (seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false)) then
    raise exception 'An active verified GSTIN is required before a listing can be published. Save it as a draft while verification is pending.';
  end if;
  return new;
end;
$$;

drop trigger if exists seller_products_require_verified_gstin on public.seller_products;
create trigger seller_products_require_verified_gstin
before insert or update of status on public.seller_products
for each row execute function public.require_verified_gstin_for_live_listing();

drop trigger if exists seller_variants_require_verified_gstin on public.seller_product_variants;
create trigger seller_variants_require_verified_gstin
before insert or update of status on public.seller_product_variants
for each row execute function public.require_verified_gstin_for_live_listing();
