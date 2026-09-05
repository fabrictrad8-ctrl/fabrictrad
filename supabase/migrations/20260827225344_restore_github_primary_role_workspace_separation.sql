create or replace function public.enforce_primary_workspace_capabilities()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'seller'::public.user_role then
    new.can_buy := false;
    new.can_sell := true;
  elsif new.role in ('admin_staff'::public.user_role, 'super_admin'::public.user_role) then
    new.can_buy := false;
    new.can_sell := false;
  elsif new.role = 'buyer'::public.user_role and new.can_buy is null then
    new.can_buy := true;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profiles_primary_workspace_capabilities on public.user_profiles;
create trigger user_profiles_primary_workspace_capabilities
before insert or update of role, can_buy, can_sell
on public.user_profiles
for each row execute function public.enforce_primary_workspace_capabilities();

create or replace function public.enforce_buyer_profile_primary_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_profiles up
    where up.id = new.user_id
      and up.role = 'seller'::public.user_role
  ) then
    new.is_active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists buyer_profiles_primary_workspace_guard on public.buyer_profiles;
create trigger buyer_profiles_primary_workspace_guard
before insert or update of user_id, is_active
on public.buyer_profiles
for each row execute function public.enforce_buyer_profile_primary_workspace();

create or replace function public.enforce_catalog_order_primary_buyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.user_profiles up
    where up.id = new.buyer_id
      and up.is_active = true
      and up.role = 'buyer'::public.user_role
      and coalesce(up.can_buy, true) = true
  ) then
    raise exception 'Buyer workspace access is required to place an order' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_order_requests_primary_buyer_guard on public.catalog_order_requests;
create trigger catalog_order_requests_primary_buyer_guard
before insert or update of buyer_id
on public.catalog_order_requests
for each row execute function public.enforce_catalog_order_primary_buyer();

select set_config('fabrictrad.trusted_capability_change', '1', true);

update public.user_profiles
set can_buy = false,
    can_sell = true,
    updated_at = now()
where role = 'seller'::public.user_role
  and (can_buy is distinct from false or can_sell is distinct from true);

update public.buyer_profiles bp
set is_active = false,
    updated_at = now()
from public.user_profiles up
where up.id = bp.user_id
  and up.role = 'seller'::public.user_role
  and bp.is_active is distinct from false;
