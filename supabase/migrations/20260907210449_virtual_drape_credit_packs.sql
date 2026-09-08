-- Virtual Drape moves from a daily rate-limit to a persistent credit wallet:
-- every buyer gets 3 free lifetime trials, then buys packs of 10 credits for
-- ₹150 (₹15/credit, linear for larger packs) via Razorpay.
create table if not exists public.drape_credit_wallets (
  buyer_id uuid primary key references auth.users(id) on delete cascade,
  free_trials_used integer not null default 0,
  free_trials_limit integer not null default 3,
  purchased_credits integer not null default 0 check (purchased_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.drape_credit_wallets enable row level security;
create policy drape_credit_wallets_select_own on public.drape_credit_wallets
  for select using (buyer_id = auth.uid());

create table if not exists public.drape_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null check (credits > 0),
  amount_paise integer not null check (amount_paise > 0),
  razorpay_order_id text not null unique,
  razorpay_payment_id text,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.drape_credit_purchases enable row level security;
create policy drape_credit_purchases_select_own on public.drape_credit_purchases
  for select using (buyer_id = auth.uid());
create index if not exists drape_credit_purchases_buyer_idx on public.drape_credit_purchases (buyer_id, created_at desc);

-- Consumes one credit for the signed-in buyer: free trials first, then the
-- purchased balance. Returns what was consumed and what remains so the UI
-- can show an accurate balance without a second round trip.
create or replace function public.consume_drape_credit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_wallet public.drape_credit_wallets%rowtype;
begin
  if v_buyer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.drape_credit_wallets (buyer_id) values (v_buyer_id)
    on conflict (buyer_id) do nothing;

  select * into v_wallet from public.drape_credit_wallets where buyer_id = v_buyer_id for update;

  if v_wallet.free_trials_used < v_wallet.free_trials_limit then
    update public.drape_credit_wallets
      set free_trials_used = free_trials_used + 1, updated_at = now()
      where buyer_id = v_buyer_id;
    return jsonb_build_object(
      'allowed', true, 'source', 'free_trial',
      'freeTrialsRemaining', v_wallet.free_trials_limit - v_wallet.free_trials_used - 1,
      'purchasedCredits', v_wallet.purchased_credits
    );
  elsif v_wallet.purchased_credits > 0 then
    update public.drape_credit_wallets
      set purchased_credits = purchased_credits - 1, updated_at = now()
      where buyer_id = v_buyer_id;
    return jsonb_build_object(
      'allowed', true, 'source', 'purchased_credit',
      'freeTrialsRemaining', 0,
      'purchasedCredits', v_wallet.purchased_credits - 1
    );
  else
    return jsonb_build_object(
      'allowed', false, 'source', null,
      'freeTrialsRemaining', 0,
      'purchasedCredits', 0
    );
  end if;
end;
$$;
revoke all on function public.consume_drape_credit() from public;
grant execute on function public.consume_drape_credit() to authenticated;

-- Read-only balance check for the UI, safe to call before attempting a generation.
create or replace function public.get_drape_credit_balance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_wallet public.drape_credit_wallets%rowtype;
begin
  if v_buyer_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.drape_credit_wallets (buyer_id) values (v_buyer_id)
    on conflict (buyer_id) do nothing;

  select * into v_wallet from public.drape_credit_wallets where buyer_id = v_buyer_id;

  return jsonb_build_object(
    'freeTrialsRemaining', greatest(0, v_wallet.free_trials_limit - v_wallet.free_trials_used),
    'purchasedCredits', v_wallet.purchased_credits,
    'totalRemaining', greatest(0, v_wallet.free_trials_limit - v_wallet.free_trials_used) + v_wallet.purchased_credits
  );
end;
$$;
revoke all on function public.get_drape_credit_balance() from public;
grant execute on function public.get_drape_credit_balance() to authenticated;

-- Called server-side (service role) only, after a Razorpay payment is verified.
-- Idempotent on razorpay_order_id so a retried webhook/verify call cannot double-credit.
create or replace function public.credit_drape_purchase(p_razorpay_order_id text, p_razorpay_payment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.drape_credit_purchases%rowtype;
begin
  select * into v_purchase from public.drape_credit_purchases
    where razorpay_order_id = p_razorpay_order_id for update;

  if not found then
    raise exception 'Unknown drape credit order' using errcode = 'P0002';
  end if;

  if v_purchase.status = 'paid' then
    return jsonb_build_object('alreadyCredited', true);
  end if;

  update public.drape_credit_purchases
    set status = 'paid', razorpay_payment_id = p_razorpay_payment_id, updated_at = now()
    where razorpay_order_id = p_razorpay_order_id;

  insert into public.drape_credit_wallets (buyer_id, purchased_credits)
    values (v_purchase.buyer_id, v_purchase.credits)
  on conflict (buyer_id) do update set
    purchased_credits = public.drape_credit_wallets.purchased_credits + v_purchase.credits,
    updated_at = now();

  return jsonb_build_object('alreadyCredited', false, 'creditsAdded', v_purchase.credits);
end;
$$;
revoke all on function public.credit_drape_purchase(text, text) from public;
