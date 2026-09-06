create or replace function public.sync_product_review_state_to_variants()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.approval_status is distinct from old.approval_status then
    if new.approval_status = 'approved' then
      update public.seller_product_variants
         set approval_status='approved',
             status=case when new.status='active' then 'active' else 'draft' end,
             admin_review_notes=null,
             updated_at=now()
       where product_id=new.id
         and seller_id=new.seller_id
         and approval_status <> 'rejected';
    elsif new.approval_status = 'rejected' then
      update public.seller_product_variants
         set approval_status='rejected',
             status='draft',
             admin_review_notes=coalesce(new.admin_review_notes,admin_review_notes),
             updated_at=now()
       where product_id=new.id
         and seller_id=new.seller_id;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists seller_products_sync_variant_review_state on public.seller_products;
create trigger seller_products_sync_variant_review_state
after update of approval_status,status on public.seller_products
for each row execute function public.sync_product_review_state_to_variants();

update public.seller_product_variants v
set approval_status='approved',
    status=case when p.status='active' then 'active' else 'draft' end,
    admin_review_notes=null,
    updated_at=now()
from public.seller_products p
where v.product_id=p.id
  and v.seller_id=p.seller_id
  and p.approval_status='approved'
  and v.approval_status <> 'rejected'
  and (v.approval_status is distinct from 'approved' or v.status is distinct from case when p.status='active' then 'active' else 'draft' end);
