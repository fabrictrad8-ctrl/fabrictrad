-- FabricTrad normalized account model:
-- every non-admin account is a buyer identity; selling is an optional capability.

create or replace function public.enforce_primary_workspace_capabilities()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.role in ('admin_staff'::public.user_role, 'super_admin'::public.user_role) then
    new.can_buy := false;
    new.can_sell := false;
  else
    -- Legacy 'seller' is no longer a mutually exclusive identity. Preserve any
    -- existing seller capability and normalize the base account to buyer.
    if new.role = 'seller'::public.user_role then
      new.role := 'buyer'::public.user_role;
    end if;
    new.can_buy := true;
    new.can_sell := coalesce(new.can_sell, false);
  end if;
  return new;
end;
$function$;

-- Approval keeps the same buyer identity and unlocks the optional selling capability.
create or replace function public.sync_verified_seller_account_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.verification_status = 'verified'::public.seller_status then
    perform set_config('fabrictrad.trusted_capability_change', '1', true);

    update public.user_profiles
       set role = 'buyer'::public.user_role,
           can_buy = true,
           can_sell = true,
           verification_status = 'verified',
           updated_at = now()
     where id = new.user_id
       and role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

    update public.buyer_profiles
       set is_active = true,
           updated_at = now()
     where user_id = new.user_id;
  end if;
  return new;
end;
$function$;

-- Repair legacy seller-only identities in-place without changing user IDs or deleting data.
select set_config('fabrictrad.trusted_capability_change', '1', true);
update public.user_profiles up
   set role = 'buyer'::public.user_role,
       can_buy = true,
       can_sell = exists (
         select 1 from public.seller_profiles sp
         where sp.user_id = up.id
           and sp.is_active = true
           and sp.verification_status = 'verified'::public.seller_status
       ),
       updated_at = now()
 where up.role = 'seller'::public.user_role;
