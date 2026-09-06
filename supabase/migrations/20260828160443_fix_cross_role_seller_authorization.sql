-- FabricTrad: restore one-account buy+sell semantics and enforce seller verification server-side.

-- Legacy triggers forced seller accounts into seller-only mode. That conflicts with
-- the current capability model (can_buy + can_sell) and deactivated buyer profiles.
drop trigger if exists trg_enforce_seller_only_workspace_role on public.seller_profiles;
drop trigger if exists buyer_profiles_primary_workspace_guard on public.buyer_profiles;

-- Protect authorization-bearing fields from ordinary profile self-service updates.
create or replace function public.protect_user_profile_capabilities()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.role() = 'service_role' or public.is_admin()
     or current_setting('fabrictrad.trusted_capability_change', true) = '1' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.can_buy is distinct from old.can_buy
     or new.can_sell is distinct from old.can_sell
     or new.account_kind is distinct from old.account_kind
     or new.verification_method is distinct from old.verification_method
     or new.verification_status is distinct from old.verification_status
     or new.identity_reference_last4 is distinct from old.identity_reference_last4
     or new.identity_verified_at is distinct from old.identity_verified_at
     or new.phone_verified is distinct from old.phone_verified then
    raise exception 'Account authorization and verification are managed by FabricTrad';
  end if;
  return new;
end;
$function$;

-- Role is retained for backwards compatibility, but it no longer removes buying
-- capability from a seller. Selling authorization is derived from verification.
create or replace function public.enforce_primary_workspace_capabilities()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.role in ('admin_staff'::public.user_role, 'super_admin'::public.user_role) then
    new.can_buy := false;
    new.can_sell := false;
  elsif new.role in ('buyer'::public.user_role, 'seller'::public.user_role) then
    new.can_buy := coalesce(new.can_buy, true);
  end if;
  return new;
end;
$function$;

-- A seller may enter onboarding before approval, but seller-managed commerce data
-- is available only after the seller profile is actually verified.
create or replace function public.can_current_user_sell()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce((
    select profile.can_sell and profile.is_active
    from public.user_profiles profile
    where profile.id = auth.uid()
  ), false)
  and exists (
    select 1
    from public.seller_profiles seller
    where seller.user_id = auth.uid()
      and seller.is_active = true
      and seller.verification_status = 'verified'::public.seller_status
  );
$function$;

create or replace function public.is_seller()
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.user_profiles profile
    join public.seller_profiles seller on seller.user_id = profile.id
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.can_sell = true
      and seller.is_active = true
      and seller.verification_status = 'verified'::public.seller_status
  );
$function$;

-- When verification completes, preserve buying and unlock selling without changing
-- identity or forcing a seller-only workspace.
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
       set can_buy = true,
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

-- Repair existing non-admin seller-capable accounts that were forced into seller-only mode.
select set_config('fabrictrad.trusted_capability_change', '1', true);
update public.user_profiles up
   set can_buy = true,
       can_sell = case
         when exists (
           select 1 from public.seller_profiles sp
           where sp.user_id = up.id
             and sp.is_active = true
             and sp.verification_status = 'verified'::public.seller_status
         ) then true
         else up.can_sell
       end,
       updated_at = now()
 where up.role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
   and exists (select 1 from public.seller_profiles sp where sp.user_id = up.id);

update public.buyer_profiles bp
   set is_active = true,
       updated_at = now()
  from public.user_profiles up
 where bp.user_id = up.id
   and up.is_active = true
   and up.can_buy = true;

-- Trigger-only SECURITY DEFINER functions must not be exposed as REST RPCs.
revoke execute on function public.enforce_shopify_order_checkout_authorization() from anon, authenticated;
revoke execute on function public.refresh_shopify_seller_settlement_entry() from anon, authenticated;

-- Helpful-vote RPC is authenticated-only and uses a fixed search path.
create or replace function public.increment_review_helpful(review_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.seller_reviews
     set helpful_count = helpful_count + 1
   where id = review_id;
end;
$function$;
revoke execute on function public.increment_review_helpful(uuid) from anon;
grant execute on function public.increment_review_helpful(uuid) to authenticated;
