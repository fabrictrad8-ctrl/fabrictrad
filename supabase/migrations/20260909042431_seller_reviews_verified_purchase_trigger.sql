-- Reconstructed from the applied live migration 20260909042431_seller_reviews_verified_purchase_trigger.
-- Recompute is_verified_purchase server-side rather than trust client input,
-- since RLS on seller_reviews only checks buyer_id ownership, not purchase history.
-- Scoped to the real marketplace order path (catalog_order_requests, status='fulfilled');
-- bespoke/custom-tailoring orders are a separate flow and are not covered here.
create or replace function public.compute_seller_review_verified_purchase()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  buyer_user_id uuid;
begin
  select user_id into buyer_user_id from public.buyer_profiles where id = new.buyer_id;
  new.is_verified_purchase := buyer_user_id is not null and exists (
    select 1 from public.catalog_order_requests
    where buyer_id = buyer_user_id and seller_id = new.seller_id and status = 'fulfilled'
  );
  new.helpful_count := coalesce(new.helpful_count, 0);
  return new;
end;
$$;

drop trigger if exists seller_reviews_verify_purchase on public.seller_reviews;
create trigger seller_reviews_verify_purchase
before insert or update of buyer_id, seller_id on public.seller_reviews
for each row execute function public.compute_seller_review_verified_purchase();
