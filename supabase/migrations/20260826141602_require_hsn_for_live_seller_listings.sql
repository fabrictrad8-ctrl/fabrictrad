create or replace function public.require_verified_gstin_for_live_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller public.seller_profiles%rowtype;
  listing_hsn text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select * into seller from public.seller_profiles where id = new.seller_id;
  if not found then
    raise exception 'Seller profile not found';
  end if;
  if not (seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false)) then
    raise exception 'An active verified GSTIN is required before a listing can be published. Save it as a draft while verification is pending.';
  end if;

  if tg_table_name = 'seller_products' then
    listing_hsn := regexp_replace(coalesce(new.hsn_code, ''), '[^0-9]', '', 'g');
  else
    select regexp_replace(coalesce(p.hsn_code, ''), '[^0-9]', '', 'g')
      into listing_hsn
    from public.seller_products p
    where p.id = new.product_id;
  end if;

  if coalesce(listing_hsn, '') = '' or length(listing_hsn) not in (4, 6, 8) then
    raise exception 'A valid 4, 6 or 8 digit HSN classification is required before a listing can be published.';
  end if;

  return new;
end;
$$;
