insert into public.platform_policies (policy_key, policy_value, description)
select 'platform_commission_rate','0.10','FabricTrad platform commission rate retained from the legacy checkout implementation.'
where not exists (select 1 from public.platform_policies where policy_key='platform_commission_rate');
insert into public.platform_policies (policy_key, policy_value, description)
select 'platform_commission_gst_rate','0.18','GST rate applied to the FabricTrad platform commission.'
where not exists (select 1 from public.platform_policies where policy_key='platform_commission_gst_rate');
insert into public.platform_policies (policy_key, policy_value, description)
select 'payment_processing_rate','0.02','Legacy FabricTrad processing-fee estimate retained for seller settlement accounting.'
where not exists (select 1 from public.platform_policies where policy_key='payment_processing_rate');
insert into public.platform_policies (policy_key, policy_value, description)
select 'seller_settlement_delay_hours','0','Hours after delivery before a reconciled Shopify seller settlement becomes requestable.'
where not exists (select 1 from public.platform_policies where policy_key='seller_settlement_delay_hours');

create table if not exists public.seller_settlement_entries (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete restrict,
  commerce_source text not null check (commerce_source in ('shopify','razorpay_catalog','razorpay_bulk')),
  operational_order_id uuid references public.orders(id) on delete restrict,
  shopify_order_gid text,
  source_payment_id uuid,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  platform_commission numeric(14,2) not null default 0 check (platform_commission >= 0),
  commission_gst numeric(14,2) not null default 0 check (commission_gst >= 0),
  processing_fee numeric(14,2) not null default 0 check (processing_fee >= 0),
  refunded_amount numeric(14,2) not null default 0 check (refunded_amount >= 0),
  net_payable numeric(14,2) not null default 0 check (net_payable >= 0),
  currency text not null default 'INR' check (currency='INR'),
  status text not null default 'hold' check (status in ('hold','eligible','requested','processing','paid','reversed','manual_review')),
  eligible_at timestamptz,
  payout_request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists seller_settlement_entries_shopify_order_uniq on public.seller_settlement_entries(operational_order_id) where commerce_source='shopify' and operational_order_id is not null;
create index if not exists seller_settlement_entries_seller_status_idx on public.seller_settlement_entries(seller_id,status,eligible_at);
create index if not exists seller_settlement_entries_payout_idx on public.seller_settlement_entries(payout_request_id) where payout_request_id is not null;

alter table public.seller_settlement_entries enable row level security;
drop policy if exists seller_settlement_entries_seller_read on public.seller_settlement_entries;
create policy seller_settlement_entries_seller_read on public.seller_settlement_entries for select to authenticated using (seller_id=public.my_seller_id());
drop policy if exists seller_settlement_entries_admin_all on public.seller_settlement_entries;
create policy seller_settlement_entries_admin_all on public.seller_settlement_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.seller_payout_requests alter column account_number drop not null;
alter table public.seller_payout_requests add column if not exists bank_profile_id uuid references public.seller_bank_profiles(id) on delete restrict;
alter table public.seller_payout_requests add column if not exists provider text not null default 'razorpayx';
alter table public.seller_payout_requests add column if not exists idempotency_key text;
alter table public.seller_payout_requests add column if not exists provider_reference text;
alter table public.seller_payout_requests add column if not exists failure_reason text;
create unique index if not exists seller_payout_requests_idempotency_uniq on public.seller_payout_requests(idempotency_key) where idempotency_key is not null;

alter table public.seller_settlement_entries drop constraint if exists seller_settlement_entries_payout_request_id_fkey;
alter table public.seller_settlement_entries add constraint seller_settlement_entries_payout_request_id_fkey foreign key (payout_request_id) references public.seller_payout_requests(id) on delete restrict;

drop policy if exists seller_payout_requests_admin_all on public.seller_payout_requests;
drop policy if exists seller_payout_requests_seller_insert on public.seller_payout_requests;
drop policy if exists seller_payout_requests_seller_select on public.seller_payout_requests;
create policy seller_payout_requests_seller_select on public.seller_payout_requests for select to authenticated using (seller_id=public.my_seller_id());
create policy seller_payout_requests_admin_all on public.seller_payout_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.seller_payout_requests from anon;

create or replace function public.refresh_shopify_seller_settlement_entry()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_commission_rate numeric := 0.10;
  v_commission_gst_rate numeric := 0.18;
  v_processing_rate numeric := 0.02;
  v_delay_hours numeric := 0;
  v_gross numeric;
  v_commission numeric;
  v_commission_gst numeric;
  v_processing numeric;
  v_net numeric;
  v_status text;
  v_eligible_at timestamptz;
begin
  if coalesce(new.commerce_source,'') <> 'shopify' or new.seller_id is null then return new; end if;
  select coalesce(max(case when policy_key='platform_commission_rate' then nullif(policy_value,'')::numeric end),0.10),
         coalesce(max(case when policy_key='platform_commission_gst_rate' then nullif(policy_value,'')::numeric end),0.18),
         coalesce(max(case when policy_key='payment_processing_rate' then nullif(policy_value,'')::numeric end),0.02),
         coalesce(max(case when policy_key='seller_settlement_delay_hours' then nullif(policy_value,'')::numeric end),0)
  into v_commission_rate,v_commission_gst_rate,v_processing_rate,v_delay_hours
  from public.platform_policies
  where policy_key in ('platform_commission_rate','platform_commission_gst_rate','payment_processing_rate','seller_settlement_delay_hours');
  v_gross := greatest(0,round(coalesce(new.total_amount,0)::numeric,2));
  v_commission := round(v_gross * greatest(0,least(v_commission_rate,0.50)),2);
  v_commission_gst := round(v_commission * greatest(0,least(v_commission_gst_rate,0.50)),2);
  v_processing := round(v_gross * greatest(0,least(v_processing_rate,0.10)),2);
  v_net := greatest(0,round(v_gross-v_commission-v_commission_gst-v_processing,2));
  if new.status::text in ('refunded','cancelled','returned') or upper(coalesce(new.payment_status,''))='REFUNDED' then
    v_status := 'reversed'; v_net := 0; v_eligible_at := null;
  elsif new.status::text='delivered' and upper(coalesce(new.payment_status,''))='PAID' and coalesce(new.requires_review,false)=false and v_gross>0 then
    v_status := 'eligible'; v_eligible_at := coalesce(new.delivered_at,new.updated_at,now()) + make_interval(hours=>greatest(0,v_delay_hours)::int);
  else
    v_status := 'hold'; v_eligible_at := null;
  end if;
  insert into public.seller_settlement_entries(seller_id,commerce_source,operational_order_id,shopify_order_gid,gross_amount,platform_commission,commission_gst,processing_fee,refunded_amount,net_payable,status,eligible_at,metadata,updated_at)
  values(new.seller_id,'shopify',new.id,new.shopify_order_gid,v_gross,v_commission,v_commission_gst,v_processing,case when v_status='reversed' then v_gross else 0 end,v_net,v_status,v_eligible_at,jsonb_build_object('shopify_order_name',new.shopify_order_name,'payment_status',new.payment_status,'fulfillment_status',new.fulfillment_status),now())
  on conflict (operational_order_id) where commerce_source='shopify' and operational_order_id is not null do update set
    seller_id=excluded.seller_id,shopify_order_gid=excluded.shopify_order_gid,gross_amount=excluded.gross_amount,platform_commission=excluded.platform_commission,commission_gst=excluded.commission_gst,processing_fee=excluded.processing_fee,refunded_amount=excluded.refunded_amount,
    net_payable=case when public.seller_settlement_entries.status in ('requested','processing','paid') then public.seller_settlement_entries.net_payable else excluded.net_payable end,
    status=case when public.seller_settlement_entries.status in ('requested','processing','paid') and excluded.status='reversed' then 'manual_review' when public.seller_settlement_entries.status in ('requested','processing','paid') then public.seller_settlement_entries.status else excluded.status end,
    eligible_at=case when public.seller_settlement_entries.status in ('requested','processing','paid') then public.seller_settlement_entries.eligible_at else excluded.eligible_at end,
    metadata=public.seller_settlement_entries.metadata || excluded.metadata, updated_at=now();
  return new;
end;
$$;

drop trigger if exists refresh_shopify_seller_settlement_entry_trigger on public.orders;
create trigger refresh_shopify_seller_settlement_entry_trigger after insert or update of status,total_amount,payment_status,fulfillment_status,requires_review,delivered_at on public.orders for each row execute function public.refresh_shopify_seller_settlement_entry();

create or replace function public.request_my_seller_payout()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_seller uuid;
  v_bank public.seller_bank_profiles%rowtype;
  v_profile public.seller_profiles%rowtype;
  v_amount numeric;
  v_request uuid := gen_random_uuid();
  v_key text;
begin
  v_seller := public.my_seller_id();
  if v_seller is null then raise exception 'Seller account required.' using errcode='42501'; end if;
  select * into v_profile from public.seller_profiles where id=v_seller for update;
  if not found or coalesce(v_profile.is_active,false)=false or coalesce(v_profile.settlement_eligible,false)=false then raise exception 'Seller is not settlement eligible.' using errcode='42501'; end if;
  select * into v_bank from public.seller_bank_profiles where seller_id=v_seller and is_verified=true order by updated_at desc nulls last limit 1;
  if not found then raise exception 'A verified settlement bank account is required.' using errcode='P0001'; end if;
  if nullif(trim(coalesce(v_bank.razorpay_fund_account_id,'')),'') is null then raise exception 'Verified bank is not yet connected to RazorpayX.' using errcode='P0001'; end if;
  if exists(select 1 from public.seller_payout_requests where seller_id=v_seller and status in ('pending','processing','queued')) then raise exception 'A payout request is already open.' using errcode='P0001'; end if;
  select round(coalesce(sum(net_payable),0),2) into v_amount from public.seller_settlement_entries where seller_id=v_seller and status='eligible' and coalesce(eligible_at,now())<=now() and payout_request_id is null;
  if v_amount < 1 then raise exception 'No eligible seller balance is available.' using errcode='P0001'; end if;
  v_key := replace(v_request::text,'-','');
  insert into public.seller_payout_requests(id,seller_id,amount,bank_name,account_number,ifsc_code,account_holder_name,status,bank_profile_id,provider,idempotency_key,submitted_at,created_at,updated_at)
  values(v_request,v_seller,v_amount,v_bank.bank_name,null,v_bank.ifsc_code,v_bank.account_holder_name,'pending',v_bank.id,'razorpayx',v_key,now(),now(),now());
  update public.seller_settlement_entries set status='requested',payout_request_id=v_request,updated_at=now() where seller_id=v_seller and status='eligible' and coalesce(eligible_at,now())<=now() and payout_request_id is null;
  return jsonb_build_object('payoutRequestId',v_request,'amount',v_amount,'currency','INR','bank',v_bank.account_number_masked,'status','pending');
end;
$$;
revoke all on function public.request_my_seller_payout() from public,anon;
grant execute on function public.request_my_seller_payout() to authenticated;
