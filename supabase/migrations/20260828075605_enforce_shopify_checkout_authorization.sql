create table if not exists public.shopify_checkout_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists shopify_checkout_authorizations_user_exp_idx
  on public.shopify_checkout_authorizations (user_id, expires_at desc);

alter table public.shopify_checkout_authorizations enable row level security;
revoke all on public.shopify_checkout_authorizations from anon, authenticated;

create or replace function public.enforce_shopify_order_checkout_authorization()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if new.commerce_source = 'shopify' then
    if new.buyer_id is null then
      raise exception 'FabricTrad checkout authorization missing: buyer profile is not linked';
    end if;

    select bp.user_id
      into v_user_id
      from public.buyer_profiles bp
     where bp.id = new.buyer_id
       and coalesce(bp.is_active, true) = true;

    if v_user_id is null then
      raise exception 'FabricTrad checkout authorization missing: active buyer profile not found';
    end if;

    if not exists (
      select 1
        from public.user_profiles up
       where up.id = v_user_id
         and up.is_active = true
         and up.can_buy = true
    ) then
      raise exception 'FabricTrad checkout authorization denied: buyer capability inactive';
    end if;

    if not exists (
      select 1
        from public.shopify_checkout_authorizations a
       where a.user_id = v_user_id
         and a.revoked_at is null
         and a.expires_at > now()
    ) then
      raise exception 'FabricTrad checkout authorization missing or expired';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_shopify_order_checkout_authorization on public.orders;
create trigger trg_enforce_shopify_order_checkout_authorization
before insert on public.orders
for each row execute function public.enforce_shopify_order_checkout_authorization();
