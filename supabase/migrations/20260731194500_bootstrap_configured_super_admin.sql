create or replace function public.enforce_configured_super_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(trim(coalesce(new.email, ''))) = 'fabrictrad8@gmail.com' then
    new.role := 'super_admin'::public.user_role;
    new.full_name := coalesce(nullif(trim(new.full_name), ''), 'FabricTrad Administrator');
    new.is_active := true;
    new.can_buy := false;
    new.can_sell := false;
    new.account_kind := 'individual';
    new.verification_method := 'none';
    new.verification_status := 'verified';
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_configured_super_admin_profile() from public, anon, authenticated;

drop trigger if exists enforce_configured_super_admin_profile_trigger on public.user_profiles;
create trigger enforce_configured_super_admin_profile_trigger
before insert or update of email, role, is_active, can_buy, can_sell
on public.user_profiles
for each row
execute function public.enforce_configured_super_admin_profile();

update public.user_profiles
set role = 'super_admin'::public.user_role,
    is_active = true,
    can_buy = false,
    can_sell = false,
    verification_status = 'verified',
    updated_at = now()
where lower(trim(email)) = 'fabrictrad8@gmail.com';

delete from public.buyer_profiles
where user_id in (
  select id from public.user_profiles
  where lower(trim(email)) = 'fabrictrad8@gmail.com'
);

delete from public.seller_profiles
where user_id in (
  select id from public.user_profiles
  where lower(trim(email)) = 'fabrictrad8@gmail.com'
);
