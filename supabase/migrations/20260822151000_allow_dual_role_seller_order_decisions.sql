-- FabricTrad accounts may have both buyer and seller capabilities.
-- When the same user is acting as the seller for an order, seller transitions
-- must be evaluated before buyer-only cancellation rules.
create or replace function public.protect_catalog_order_request_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_seller_id uuid;
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.buyer_id is distinct from old.buyer_id
    or new.seller_id is distinct from old.seller_id
    or new.product_id is distinct from old.product_id
    or new.variant_id is distinct from old.variant_id
    or new.quantity is distinct from old.quantity
    or new.unit is distinct from old.unit
    or new.price_per_unit is distinct from old.price_per_unit
    or new.subtotal is distinct from old.subtotal
    or new.gst_amount is distinct from old.gst_amount
    or new.total_amount is distinct from old.total_amount then
    raise exception 'Order ownership, products, quantities and totals cannot be changed';
  end if;

  actor_seller_id := public.my_seller_id();
  if actor_seller_id = old.seller_id and public.can_current_user_sell() then
    if new.status is distinct from old.status
      and not (
        (old.status = 'pending' and new.status in ('accepted','rejected'))
        or (old.status = 'paid' and new.status = 'fulfilled')
      ) then
      raise exception 'Seller is not allowed to set this order status';
    end if;
    return new;
  end if;

  if auth.uid() = old.buyer_id and public.can_current_user_buy() then
    if new.status is distinct from old.status
      and not (old.status in ('pending','accepted') and new.status = 'cancelled') then
      raise exception 'Buyer is not allowed to set this order status';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update this order';
end;
$$;
