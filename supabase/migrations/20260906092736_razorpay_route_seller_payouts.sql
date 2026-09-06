-- Route state is written only by authenticated server handlers after provider checks.
create table public.seller_payout_accounts (
  seller_id uuid primary key references public.seller_profiles(id) on delete restrict,
  linked_account_id text unique,
  stakeholder_id text unique,
  product_id text unique,
  business_type text,
  activation_status text not null default 'not_connected',
  setup_state text not null default 'draft',
  bank_last4 text check (bank_last4 is null or bank_last4 ~ '^[0-9]{4}$'),
  bank_ifsc text,
  bank_fingerprint text,
  beneficiary_name text,
  requirements jsonb not null default '[]',
  terms_accepted_at timestamptz,
  verified_at timestamptz,
  checked_at timestamptz,
  last_error_code text,
  lock_token uuid,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.seller_payout_accounts enable row level security;
revoke all on public.seller_payout_accounts from public, anon, authenticated;
grant all on public.seller_payout_accounts to service_role;
comment on table public.seller_payout_accounts is 'Server-only Razorpay Route verification. Full bank numbers and representative PAN are never stored.';

create table public.marketplace_checkout_leases (
  order_type text not null check (order_type in ('catalog','bulk','bespoke')),
  order_id uuid not null,
  token uuid not null,
  expires_at timestamptz not null,
  primary key (order_type, order_id)
);
alter table public.marketplace_checkout_leases enable row level security;
revoke all on public.marketplace_checkout_leases from public, anon, authenticated;
grant all on public.marketplace_checkout_leases to service_role;

create function public.claim_marketplace_checkout(p_order_type text, p_order_id uuid, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_claimed boolean;
begin
  insert into public.marketplace_checkout_leases(order_type,order_id,token,expires_at)
  values(p_order_type,p_order_id,p_token,now()+interval '3 minutes')
  on conflict (order_type,order_id) do update set token=excluded.token,expires_at=excluded.expires_at
  where public.marketplace_checkout_leases.expires_at < now()
  returning true into v_claimed;
  return coalesce(v_claimed,false);
end; $$;
create function public.release_marketplace_checkout(p_order_type text, p_order_id uuid, p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  delete from public.marketplace_checkout_leases where order_type=p_order_type and order_id=p_order_id and token=p_token;
$$;
revoke all on function public.claim_marketplace_checkout(text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.release_marketplace_checkout(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_marketplace_checkout(text,uuid,uuid) to service_role;
grant execute on function public.release_marketplace_checkout(text,uuid,uuid) to service_role;

-- A custom order needs an explicit seller before any new payment can be collected.
-- Buyers use the authorised API for edits; direct row writes must not forge
-- quotes, balances, status or the seller assignment.
revoke insert, update, delete on public.bespoke_orders from anon, authenticated;
drop policy if exists bespoke_orders_insert_own on public.bespoke_orders;
drop policy if exists bespoke_orders_update_own on public.bespoke_orders;
alter table public.bespoke_orders add column if not exists seller_id uuid references public.seller_profiles(id) on delete restrict;
create index if not exists bespoke_orders_seller_id_idx on public.bespoke_orders(seller_id) where seller_id is not null;
alter table public.bespoke_payments add column if not exists platform_commission numeric(12,2) not null default 0;
alter table public.bespoke_payments add column if not exists gst_on_commission numeric(12,2) not null default 0;
alter table public.bespoke_payments add column if not exists seller_payable numeric(12,2) not null default 0;
alter table public.bespoke_payments add column if not exists razorpay_transfer_id text;
alter table public.bespoke_payments add column if not exists transfer_status text;

do $$ declare v_table text; begin
  foreach v_table in array array['catalog_order_payments','bulk_order_payments','bespoke_payments'] loop
    execute format('alter table public.%I add column if not exists split_version text',v_table);
    execute format('alter table public.%I add column if not exists platform_retained numeric(12,2)',v_table);
    execute format('alter table public.%I add column if not exists transfer_account_id text',v_table);
    execute format('alter table public.%I add column if not exists transfer_amount_paise bigint',v_table);
    execute format('alter table public.%I add column if not exists transfer_amount_reversed_paise bigint not null default 0',v_table);
    execute format('alter table public.%I add column if not exists transfer_settlement_id text',v_table);
    execute format('alter table public.%I add column if not exists transfer_checked_at timestamptz',v_table);
  end loop;
end $$;

-- Atomic transfer reconciliation rejects mismatched sources, recipients and amounts,
-- and never regresses a known reversal or confirmed bank settlement on delayed events.
create function public.reconcile_marketplace_route_transfer(
  p_kind text, p_payment_id uuid, p_transfer_id text, p_source text,
  p_account text, p_amount bigint, p_currency text, p_status text,
  p_reversed bigint, p_settlement_id text, p_checked_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_table text; v_row record; v_status text;
begin
  v_table := case p_kind when 'catalog' then 'catalog_order_payments' when 'bulk' then 'bulk_order_payments' when 'bespoke' then 'bespoke_payments' end;
  if v_table is null or p_status not in ('created','pending','processed','failed','reversed','partially_reversed','settled','on_hold') then raise exception 'Invalid transfer state'; end if;
  execute format('select * from public.%I where id=$1 for update',v_table) into v_row using p_payment_id;
  if v_row.id is null then raise exception 'Payment not found'; end if;
  if v_row.transfer_account_id is null or v_row.transfer_account_id <> p_account
    or v_row.transfer_amount_paise is distinct from p_amount
    or p_currency <> 'INR' or p_source not in (v_row.razorpay_order_id,coalesce(v_row.razorpay_payment_id,''))
    or p_transfer_id !~ '^trf_[A-Za-z0-9]+$'
    or (v_row.razorpay_transfer_id is not null and v_row.razorpay_transfer_id <> p_transfer_id)
    or p_reversed < 0 or p_reversed > p_amount then raise exception 'Transfer does not match payment'; end if;
  if v_row.transfer_checked_at > p_checked_at or v_row.transfer_amount_reversed_paise > p_reversed then return false; end if;
  v_status := case when p_reversed=p_amount then 'reversed' when p_reversed>0 then 'partially_reversed'
    when v_row.transfer_status='settled' then 'settled' else p_status end;
  execute format('update public.%I set razorpay_transfer_id=$1,transfer_status=$2,transfer_amount_reversed_paise=$3,transfer_settlement_id=coalesce($4,transfer_settlement_id),transfer_checked_at=$5,updated_at=now() where id=$6',v_table)
    using p_transfer_id,v_status,p_reversed,p_settlement_id,p_checked_at,p_payment_id;
  return true;
end $$;
revoke all on function public.reconcile_marketplace_route_transfer(text,uuid,text,text,text,bigint,text,text,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_marketplace_route_transfer(text,uuid,text,text,text,bigint,text,text,bigint,text,timestamptz) to service_role;
