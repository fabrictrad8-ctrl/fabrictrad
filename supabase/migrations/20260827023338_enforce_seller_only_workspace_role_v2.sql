create or replace function public.enforce_seller_only_workspace_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and coalesce(new.is_active, true) = true then
    perform set_config('fabrictrad.trusted_capability_change', '1', true);

    update public.user_profiles
       set role = 'seller'::public.user_role,
           can_buy = false,
           can_sell = true,
           account_kind = 'business',
           updated_at = now()
     where id = new.user_id
       and role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

    update public.buyer_profiles
       set is_active = false,
           updated_at = now()
     where user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_seller_only_workspace_role() from public, anon, authenticated;

drop trigger if exists trg_enforce_seller_only_workspace_role on public.seller_profiles;
create trigger trg_enforce_seller_only_workspace_role
after insert or update of user_id, is_active on public.seller_profiles
for each row
execute function public.enforce_seller_only_workspace_role();

select set_config('fabrictrad.trusted_capability_change', '1', true);

update public.user_profiles up
   set role = 'seller'::public.user_role,
       can_buy = false,
       can_sell = true,
       account_kind = 'business',
       updated_at = now()
 where up.role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
   and exists (
     select 1 from public.seller_profiles sp
      where sp.user_id = up.id
        and coalesce(sp.is_active, true) = true
   );

update public.buyer_profiles bp
   set is_active = false,
       updated_at = now()
 where exists (
   select 1 from public.seller_profiles sp
    where sp.user_id = bp.user_id
      and coalesce(sp.is_active, true) = true
 );
