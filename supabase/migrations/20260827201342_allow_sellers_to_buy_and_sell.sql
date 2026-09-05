create or replace function public.enforce_primary_workspace_capabilities()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.role = 'seller'::public.user_role then
    new.can_buy := true;
    new.can_sell := true;
  elsif new.role in ('admin_staff'::public.user_role, 'super_admin'::public.user_role) then
    new.can_buy := false;
    new.can_sell := false;
  elsif new.role = 'buyer'::public.user_role and new.can_buy is null then
    new.can_buy := true;
  end if;
  return new;
end;
$function$;

do $migration$
begin
  perform set_config('fabrictrad.trusted_capability_change', '1', true);
  update public.user_profiles
     set can_buy = true,
         can_sell = true,
         updated_at = now()
   where is_active = true
     and role = 'seller'::public.user_role;
end
$migration$;
