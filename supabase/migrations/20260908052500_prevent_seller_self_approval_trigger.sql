-- RLS on seller_products/seller_product_variants only checks row ownership
-- (seller_id = my_seller_id()), not which columns a seller writes. Without
-- this trigger, any seller could set approval_status = 'approved' directly
-- in their own insert/update payload and self-publish straight to the live
-- marketplace, bypassing admin moderation entirely.
create or replace function public.prevent_seller_self_approval()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not public.is_admin() and auth.role() is distinct from 'service_role' then
    if new.approval_status = 'approved' then
      new.approval_status := 'pending';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_prevent_seller_self_approval on public.seller_products;
create trigger trg_prevent_seller_self_approval
  before insert or update on public.seller_products
  for each row execute function public.prevent_seller_self_approval();

drop trigger if exists trg_prevent_seller_self_approval_variants on public.seller_product_variants;
create trigger trg_prevent_seller_self_approval_variants
  before insert or update on public.seller_product_variants
  for each row execute function public.prevent_seller_self_approval();
