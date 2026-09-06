alter table public.catalog_order_requests add column if not exists stock_released_at timestamptz;

create or replace function public.release_catalog_order_stock_on_terminal_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('accepted','paid')
     and new.status in ('cancelled','rejected')
     and old.stock_released_at is null
     and new.stock_released_at is null then
    if old.variant_id is not null then
      update public.seller_product_variants
         set available_quantity = available_quantity + old.quantity,
             updated_at = now()
       where id = old.variant_id
         and product_id = old.product_id
         and seller_id = old.seller_id;
    else
      update public.seller_products
         set available_quantity = available_quantity + old.quantity,
             updated_at = now()
       where id = old.product_id
         and seller_id = old.seller_id;
    end if;
    new.stock_released_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_release_stock_on_terminal_cancel on public.catalog_order_requests;
create trigger catalog_release_stock_on_terminal_cancel
before update of status on public.catalog_order_requests
for each row
execute function public.release_catalog_order_stock_on_terminal_cancel();
