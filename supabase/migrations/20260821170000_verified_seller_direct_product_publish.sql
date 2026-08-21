create or replace function public.protect_product_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  seller_can_publish boolean := false;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.admin_review_notes is not null then
      raise exception 'Product review notes are managed by FabricTrad.' using errcode = '42501';
    end if;
  elsif new.admin_review_notes is distinct from old.admin_review_notes then
    raise exception 'Product review notes are managed by FabricTrad.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.seller_profiles sp
    where sp.id = new.seller_id
      and sp.verification_status::text = 'verified'
      and coalesce(sp.is_active, true) = true
  ) into seller_can_publish;

  if tg_op = 'UPDATE' and old.approval_status = 'rejected' then
    new.approval_status := 'rejected';
    return new;
  end if;

  if new.status = 'active' then
    if not seller_can_publish then
      raise exception 'Seller verification must be approved before products can be published.' using errcode = '42501';
    end if;
    new.approval_status := 'approved';
  else
    new.approval_status := 'not_submitted';
  end if;

  return new;
end;
$$;
