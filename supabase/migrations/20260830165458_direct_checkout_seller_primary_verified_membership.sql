-- FabricTrad direct checkout, seller-primary role repair, seller-initiated messaging,
-- and verified-seller membership foundation.

-- 1) Preserve an explicitly seller-primary account instead of silently rewriting it to buyer.
create or replace function public.enforce_primary_workspace_capabilities()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.role in ('admin_staff'::public.user_role, 'super_admin'::public.user_role) then
    new.can_buy := false;
    new.can_sell := false;
  elsif new.role = 'seller'::public.user_role then
    new.can_buy := false;
    new.can_sell := coalesce(new.can_sell, true);
  else
    new.role := 'buyer'::public.user_role;
    new.can_buy := true;
    new.can_sell := coalesce(new.can_sell, false);
  end if;
  return new;
end;
$$;

create or replace function public.sync_verified_seller_account_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  requested_primary text;
  seller_primary boolean := false;
  selling_enabled boolean := new.verification_status = 'verified'::public.seller_status and new.is_active = true;
begin
  perform set_config('fabrictrad.trusted_capability_change', '1', true);

  select lower(coalesce(
    u.raw_app_meta_data->>'primary_role',
    u.raw_user_meta_data->>'role',
    u.raw_user_meta_data->>'user_type',
    ''
  ))
  into requested_primary
  from auth.users u
  where u.id = new.user_id;

  seller_primary := requested_primary = 'seller'
    or exists (
      select 1 from public.user_profiles up
      where up.id = new.user_id and up.role = 'seller'::public.user_role
    );

  update public.user_profiles
     set role = case when seller_primary then 'seller'::public.user_role else 'buyer'::public.user_role end,
         can_buy = not seller_primary,
         can_sell = selling_enabled,
         verification_status = case
           when selling_enabled then 'verified'
           when new.verification_status in ('rejected'::public.seller_status, 'suspended'::public.seller_status, 'permanently_blocked'::public.seller_status) then new.verification_status::text
           else 'pending'
         end,
         updated_at = now()
   where id = new.user_id
     and role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

  update public.buyer_profiles
     set is_active = not seller_primary,
         updated_at = now()
   where user_id = new.user_id;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('primary_role', case when seller_primary then 'seller' else 'buyer' end),
         updated_at = now()
   where id = new.user_id;

  if selling_enabled then
    update public.seller_registrations
       set registration_status = 'approved',
           rejection_reason = null,
           approved_at = coalesce(approved_at, now()),
           updated_at = now()
     where user_id = new.user_id
       and registration_status is distinct from 'approved';
  elsif new.verification_status = 'rejected'::public.seller_status then
    update public.seller_registrations
       set registration_status = 'rejected',
           approved_at = null,
           updated_at = now()
     where user_id = new.user_id
       and registration_status is distinct from 'rejected';
  end if;

  return new;
end;
$$;

-- Repair the known Bhanu seller account using its explicit seller identity.
do $$
declare
  target_id uuid;
begin
  select id into target_id from auth.users where lower(email) = 'bhanucatalog@gmail.com' limit 1;
  if target_id is not null then
    perform set_config('fabrictrad.trusted_capability_change', '1', true);
    update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('primary_role','seller'),
          updated_at = now()
      where id = target_id;
    update public.user_profiles
      set role = 'seller'::public.user_role,
          can_buy = false,
          can_sell = true,
          account_kind = 'business',
          updated_at = now()
      where id = target_id;
    update public.buyer_profiles set is_active = false, updated_at = now() where user_id = target_id;
    update public.seller_profiles set is_active = true, updated_at = now() where user_id = target_id;
  end if;
end $$;

-- 2) Verified seller tag is a separate commercial entitlement from KYC/GST verification.
create table if not exists public.seller_verified_memberships (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.seller_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('early_bird','subscription')),
  status text not null default 'active' check (status in ('active','pending','past_due','cancelled','expired')),
  early_bird_number integer unique check (early_bird_number between 1 and 100),
  monthly_price_paise integer not null default 20000 check (monthly_price_paise = 20000),
  currency text not null default 'INR' check (currency = 'INR'),
  razorpay_plan_id text,
  razorpay_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  verified_since timestamptz not null default now(),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_verified_memberships enable row level security;
drop policy if exists seller_verified_memberships_owner_read on public.seller_verified_memberships;
create policy seller_verified_memberships_owner_read
on public.seller_verified_memberships for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists seller_verified_memberships_admin_manage on public.seller_verified_memberships;
create policy seller_verified_memberships_admin_manage
on public.seller_verified_memberships for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop trigger if exists seller_verified_memberships_updated_at on public.seller_verified_memberships;
create trigger seller_verified_memberships_updated_at
before update on public.seller_verified_memberships
for each row execute function public.set_updated_at();

create or replace function public.seller_has_verified_tag(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.seller_verified_memberships m
    where m.seller_id = p_seller_id
      and m.status = 'active'
      and (
        m.source = 'early_bird'
        or m.current_period_end is null
        or m.current_period_end > now()
      )
  );
$$;
grant execute on function public.seller_has_verified_tag(uuid) to authenticated;

create or replace function public.seller_verified_tags(p_seller_ids uuid[])
returns table(seller_id uuid, verified_tag boolean)
language sql
stable
security definer
set search_path to ''
as $$
  select requested_id,
         exists (
           select 1 from public.seller_verified_memberships m
           where m.seller_id = requested_id
             and m.status = 'active'
             and (m.source = 'early_bird' or m.current_period_end is null or m.current_period_end > now())
         )
  from unnest(coalesce(p_seller_ids, array[]::uuid[])) requested_id;
$$;
grant execute on function public.seller_verified_tags(uuid[]) to authenticated;

create or replace function public.claim_verified_seller_early_bird(p_seller_id uuid default null)
returns public.seller_verified_memberships
language plpgsql
security definer
set search_path to ''
as $$
declare
  resolved_seller_id uuid := coalesce(p_seller_id, public.my_seller_id());
  seller_row public.seller_profiles%rowtype;
  existing_row public.seller_verified_memberships%rowtype;
  next_slot integer;
begin
  if resolved_seller_id is null then raise exception 'Seller profile is required'; end if;

  select * into seller_row from public.seller_profiles where id = resolved_seller_id for update;
  if not found then raise exception 'Seller profile not found'; end if;
  if not (seller_row.is_active and seller_row.verification_status = 'verified'::public.seller_status) then
    raise exception 'Seller must complete verification before receiving a verified tag';
  end if;
  if auth.uid() is not null and auth.role() <> 'service_role' and not public.is_admin() and seller_row.user_id <> auth.uid() then
    raise exception 'Not authorised for this seller' using errcode = '42501';
  end if;

  select * into existing_row from public.seller_verified_memberships where seller_id = resolved_seller_id;
  if found then return existing_row; end if;

  perform pg_advisory_xact_lock(hashtext('fabrictrad_verified_seller_early_bird'));
  select coalesce(max(early_bird_number),0) + 1 into next_slot
  from public.seller_verified_memberships where source = 'early_bird';
  if next_slot > 100 then raise exception 'The 100 early-bird verified seller places have been claimed'; end if;

  insert into public.seller_verified_memberships(
    seller_id,user_id,source,status,early_bird_number,current_period_start,current_period_end
  ) values (
    seller_row.id,seller_row.user_id,'early_bird','active',next_slot,now(),null
  ) returning * into existing_row;
  return existing_row;
end;
$$;
grant execute on function public.claim_verified_seller_early_bird(uuid) to authenticated;

create or replace function public.auto_claim_verified_seller_early_bird()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.is_active = true and new.verification_status = 'verified'::public.seller_status
     and not exists (select 1 from public.seller_verified_memberships m where m.seller_id = new.id) then
    begin
      perform public.claim_verified_seller_early_bird(new.id);
    exception when others then
      if sqlerrm not like '%100 early-bird%' then raise; end if;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists seller_auto_verified_early_bird on public.seller_profiles;
create trigger seller_auto_verified_early_bird
after insert or update of verification_status,is_active on public.seller_profiles
for each row execute function public.auto_claim_verified_seller_early_bird();

-- Backfill early-bird tags for already verified sellers, oldest first.
do $$
declare r record;
begin
  for r in
    select id from public.seller_profiles
    where is_active = true and verification_status = 'verified'::public.seller_status
    order by created_at,id
  loop
    begin
      perform public.claim_verified_seller_early_bird(r.id);
    exception when others then
      if sqlerrm not like '%100 early-bird%' then raise; end if;
    end;
  end loop;
end $$;

-- 3) Direct catalogue checkout: stock is locked and committed automatically, no seller approval click.
alter table public.catalog_order_requests
  add column if not exists seller_rejection_reason text,
  add column if not exists seller_rejection_requested_at timestamptz;

create or replace function public.submit_catalog_order_request(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_company_id uuid default null,
  p_company_location_id uuid default null,
  p_purchase_order_number text default null,
  p_payment_terms text default 'due_on_order',
  p_deposit_percent numeric default 0,
  p_requires_review boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_user_id uuid := auth.uid();
  product_seller_id uuid;
  product_unit text;
  available_stock numeric;
  reserved_stock numeric;
  due_at timestamptz;
  created public.catalog_order_requests%rowtype;
  existing_order public.catalog_order_requests%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if not exists (
    select 1 from public.user_profiles up
    join public.buyer_profiles bp on bp.user_id = up.id
    where up.id = current_user_id and up.is_active = true
      and up.role = 'buyer'::public.user_role and coalesce(up.can_buy,true) = true and bp.is_active = true
  ) then
    raise exception 'Buyer workspace access is required to place or reuse an order' using errcode = '42501';
  end if;

  select seller_id,unit into product_seller_id,product_unit
  from public.seller_products where id = p_product_id;
  if product_seller_id is null then raise exception 'Product not found'; end if;

  select * into existing_order
  from public.catalog_order_requests
  where buyer_id = current_user_id and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and status in ('pending','accepted','paid')
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object(
      'id',existing_order.id,'orderRef',existing_order.id,'existing',true,
      'status',existing_order.status,'paymentStatus',existing_order.payment_status,
      'requiresReview',existing_order.requires_review,'reviewStatus',existing_order.review_status,
      'buyerType',existing_order.buyer_type,'quantity',existing_order.quantity,'unit',existing_order.unit,
      'pricePerUnit',existing_order.price_per_unit,'subtotal',existing_order.subtotal,
      'gstAmount',existing_order.gst_amount,'totalAmount',existing_order.total_amount,
      'invoiceType',existing_order.tax_invoice_type,'inputTaxCreditPossible',existing_order.input_tax_credit_possible,
      'taxNote',existing_order.tax_note
    );
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.b2b_company_accounts c
    where c.id=p_company_id and c.owner_user_id=current_user_id and c.status='active'
  ) then raise exception 'Company account does not belong to this buyer or is not active' using errcode='42501'; end if;
  if p_company_location_id is not null and (
    p_company_id is null or not exists (
      select 1 from public.b2b_company_locations l where l.id=p_company_location_id and l.company_id=p_company_id
    )
  ) then raise exception 'Company location does not belong to the selected company' using errcode='42501'; end if;

  -- Serialize buyers competing for the same physical stock before authoritative pricing/tax trigger runs.
  if p_variant_id is not null then
    select available_quantity,reserved_quantity into available_stock,reserved_stock
    from public.seller_product_variants
    where id=p_variant_id and product_id=p_product_id and seller_id=product_seller_id
    for update;
    if not found or p_quantity > greatest(coalesce(available_stock,0)-coalesce(reserved_stock,0),0) then
      raise exception 'Requested quantity is outside the available stock';
    end if;
  else
    select available_quantity,reserved_quantity into available_stock,reserved_stock
    from public.seller_products where id=p_product_id and seller_id=product_seller_id for update;
    if not found or p_quantity > greatest(coalesce(available_stock,0)-coalesce(reserved_stock,0),0) then
      raise exception 'Requested quantity is outside the available stock';
    end if;
  end if;

  due_at := case coalesce(nullif(trim(p_payment_terms),''),'due_on_order')
    when 'due_on_fulfillment' then null
    when 'net_7' then now()+interval '7 days'
    when 'net_15' then now()+interval '15 days'
    when 'net_30' then now()+interval '30 days'
    when 'net_45' then now()+interval '45 days'
    when 'net_60' then now()+interval '60 days'
    when 'net_90' then now()+interval '90 days'
    else now()+interval '48 hours'
  end;

  insert into public.catalog_order_requests(
    buyer_id,seller_id,product_id,variant_id,quantity,unit,
    price_per_unit,subtotal,gst_amount,total_amount,status,
    company_id,company_location_id,purchase_order_number,
    payment_terms,deposit_percent,payment_due_at,requires_review,review_status,notes
  ) values (
    current_user_id,product_seller_id,p_product_id,p_variant_id,p_quantity,
    coalesce((select v.unit from public.seller_product_variants v where v.id=p_variant_id and v.product_id=p_product_id),product_unit),
    0,0,0,0,
    case when coalesce(p_requires_review,false) then 'pending' else 'accepted' end,
    p_company_id,p_company_location_id,nullif(trim(p_purchase_order_number),''),
    coalesce(nullif(trim(p_payment_terms),''),'due_on_order'),
    greatest(least(coalesce(p_deposit_percent,0),100),0),
    case when coalesce(p_requires_review,false) then null else due_at end,
    coalesce(p_requires_review,false),
    case when coalesce(p_requires_review,false) then 'pending' else 'not_required' end,
    left(nullif(trim(p_notes),''),2000)
  ) returning * into created;

  if created.requires_review then
    if created.variant_id is not null then
      update public.seller_product_variants
      set reserved_quantity=coalesce(reserved_quantity,0)+created.quantity,updated_at=now()
      where id=created.variant_id and product_id=created.product_id and seller_id=created.seller_id;
    else
      update public.seller_products
      set reserved_quantity=coalesce(reserved_quantity,0)+created.quantity,updated_at=now()
      where id=created.product_id and seller_id=created.seller_id;
    end if;
  else
    if created.variant_id is not null then
      update public.seller_product_variants
      set available_quantity=available_quantity-created.quantity,updated_at=now()
      where id=created.variant_id and product_id=created.product_id and seller_id=created.seller_id;
    else
      update public.seller_products
      set available_quantity=available_quantity-created.quantity,updated_at=now()
      where id=created.product_id and seller_id=created.seller_id;
    end if;
  end if;

  return jsonb_build_object(
    'id',created.id,'orderRef',created.id,'existing',false,
    'status',created.status,'paymentStatus',created.payment_status,
    'requiresReview',created.requires_review,'reviewStatus',created.review_status,
    'buyerType',created.buyer_type,'quantity',created.quantity,'unit',created.unit,
    'pricePerUnit',created.price_per_unit,'subtotal',created.subtotal,
    'gstAmount',created.gst_amount,'totalAmount',created.total_amount,
    'invoiceType',created.tax_invoice_type,'inputTaxCreditPossible',created.input_tax_credit_possible,
    'taxNote',created.tax_note
  );
end;
$$;

create or replace function public.review_company_catalog_order(p_order_id uuid,p_decision text)
returns public.catalog_order_requests
language plpgsql
security definer
set search_path to ''
as $$
declare
  request_row public.catalog_order_requests%rowtype;
  due_at timestamptz;
begin
  if p_decision not in ('approve','reject') then raise exception 'Unsupported review decision'; end if;
  select request.* into request_row
  from public.catalog_order_requests request
  join public.b2b_company_accounts company on company.id=request.company_id
  where request.id=p_order_id and request.buyer_id=auth.uid() and company.owner_user_id=auth.uid()
  for update of request;
  if not found then raise exception 'Order request not found'; end if;
  if not request_row.requires_review then raise exception 'This order does not require company review'; end if;
  if request_row.status <> 'pending' or request_row.review_status <> 'pending' then raise exception 'This request has already been reviewed'; end if;

  if request_row.variant_id is not null then
    perform 1 from public.seller_product_variants where id=request_row.variant_id and product_id=request_row.product_id and seller_id=request_row.seller_id for update;
  else
    perform 1 from public.seller_products where id=request_row.product_id and seller_id=request_row.seller_id for update;
  end if;

  if p_decision='reject' then
    if request_row.variant_id is not null then
      update public.seller_product_variants set reserved_quantity=greatest(coalesce(reserved_quantity,0)-request_row.quantity,0),updated_at=now() where id=request_row.variant_id;
    else
      update public.seller_products set reserved_quantity=greatest(coalesce(reserved_quantity,0)-request_row.quantity,0),updated_at=now() where id=request_row.product_id;
    end if;
    update public.catalog_order_requests
      set review_status='rejected',status='cancelled',notes=concat_ws(E'\n',nullif(notes,''),'Company review: rejected.'),updated_at=now()
      where id=p_order_id returning * into request_row;
    return request_row;
  end if;

  due_at := case request_row.payment_terms
    when 'due_on_fulfillment' then null when 'net_7' then now()+interval '7 days'
    when 'net_15' then now()+interval '15 days' when 'net_30' then now()+interval '30 days'
    when 'net_45' then now()+interval '45 days' when 'net_60' then now()+interval '60 days'
    when 'net_90' then now()+interval '90 days' else now()+interval '48 hours' end;

  if request_row.variant_id is not null then
    update public.seller_product_variants
      set available_quantity=available_quantity-request_row.quantity,
          reserved_quantity=greatest(coalesce(reserved_quantity,0)-request_row.quantity,0),updated_at=now()
      where id=request_row.variant_id and reserved_quantity >= request_row.quantity;
    if not found then raise exception 'Reserved stock is no longer available'; end if;
  else
    update public.seller_products
      set available_quantity=available_quantity-request_row.quantity,
          reserved_quantity=greatest(coalesce(reserved_quantity,0)-request_row.quantity,0),updated_at=now()
      where id=request_row.product_id and reserved_quantity >= request_row.quantity;
    if not found then raise exception 'Reserved stock is no longer available'; end if;
  end if;

  update public.catalog_order_requests
    set review_status='approved',status='accepted',payment_due_at=due_at,
        notes=concat_ws(E'\n',nullif(notes,''),'Company review: approved. Stock confirmed automatically.'),updated_at=now()
    where id=p_order_id returning * into request_row;
  return request_row;
end;
$$;

create or replace function public.restore_catalog_order_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.status in ('accepted','paid') and new.status in ('rejected','cancelled') and new.status is distinct from old.status then
    if old.variant_id is not null then
      update public.seller_product_variants
        set available_quantity=available_quantity+old.quantity,updated_at=now()
        where id=old.variant_id and product_id=old.product_id and seller_id=old.seller_id;
    else
      update public.seller_products
        set available_quantity=available_quantity+old.quantity,updated_at=now()
        where id=old.product_id and seller_id=old.seller_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_catalog_order_request_state()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare actor_seller_id uuid;
begin
  if auth.role()='service_role' or public.is_admin() then return new; end if;
  if new.buyer_id is distinct from old.buyer_id or new.seller_id is distinct from old.seller_id
    or new.product_id is distinct from old.product_id or new.variant_id is distinct from old.variant_id
    or new.quantity is distinct from old.quantity or new.unit is distinct from old.unit
    or new.price_per_unit is distinct from old.price_per_unit or new.subtotal is distinct from old.subtotal
    or new.gst_amount is distinct from old.gst_amount or new.total_amount is distinct from old.total_amount then
    raise exception 'Order ownership, products, quantities and totals cannot be changed';
  end if;
  actor_seller_id := public.my_seller_id();
  if actor_seller_id=old.seller_id and public.can_current_user_sell() then
    if new.status is distinct from old.status then
      if old.status='accepted' and new.status='rejected' and coalesce(old.amount_paid,0)-coalesce(old.amount_refunded,0) <= 0 then return new; end if;
      if old.status='paid' and new.status='fulfilled' then
        if not exists(select 1 from public.seller_shipments s where s.catalog_order_id=old.id and s.seller_id=old.seller_id and s.status='delivered') then
          raise exception 'This order can only be fulfilled after the shipment is marked delivered';
        end if;
        return new;
      end if;
      raise exception 'Seller is not allowed to set this order status';
    end if;
    return new;
  end if;
  if auth.uid()=old.buyer_id and public.can_current_user_buy() then
    if new.status is distinct from old.status and not (old.status in ('pending','accepted') and new.status='cancelled' and coalesce(old.amount_paid,0)-coalesce(old.amount_refunded,0)<=0) then
      raise exception 'Buyer is not allowed to set this order status';
    end if;
    return new;
  end if;
  raise exception 'Not authorized to update this order';
end;
$$;

create or replace function public.seller_reject_catalog_order(p_order_id uuid,p_reason text)
returns public.catalog_order_requests
language plpgsql
security definer
set search_path to ''
as $$
declare
  request_row public.catalog_order_requests%rowtype;
  seller_profile_id uuid := public.my_seller_id();
begin
  if seller_profile_id is null or not public.can_current_user_sell() then raise exception 'Seller access is required'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A rejection reason is required'; end if;
  select * into request_row from public.catalog_order_requests
    where id=p_order_id and seller_id=seller_profile_id for update;
  if not found then raise exception 'Order not found'; end if;
  if request_row.status <> 'accepted' then raise exception 'Only an unshipped confirmed order can be rejected here'; end if;
  if coalesce(request_row.amount_paid,0)-coalesce(request_row.amount_refunded,0) > 0 then
    raise exception 'This order has captured money and must use the refund-and-reject action';
  end if;
  update public.catalog_order_requests
    set status='rejected',seller_rejection_reason=left(trim(p_reason),1000),seller_rejection_requested_at=now(),
        notes=concat_ws(E'\n',nullif(notes,''),'Seller cancellation: '||left(trim(p_reason),1000)),updated_at=now()
    where id=p_order_id returning * into request_row;
  return request_row;
end;
$$;
grant execute on function public.seller_reject_catalog_order(uuid,text) to authenticated;

-- Keep the legacy decision RPC safe for stale clients: acceptance is automatic now.
create or replace function public.seller_decide_catalog_order(p_order_id uuid,p_action text,p_reason text default null)
returns public.catalog_order_requests
language plpgsql
security definer
set search_path to ''
as $$
declare request_row public.catalog_order_requests%rowtype;
begin
  if p_action='reject' then return public.seller_reject_catalog_order(p_order_id,coalesce(nullif(trim(p_reason),''),'Unable to fulfil this order.')); end if;
  if p_action='accept' then
    select * into request_row from public.catalog_order_requests where id=p_order_id and seller_id=public.my_seller_id();
    if not found then raise exception 'Order not found'; end if;
    if request_row.status='accepted' then return request_row; end if;
    raise exception 'Seller approval is no longer required. Stock is confirmed automatically at checkout.';
  end if;
  raise exception 'Unsupported order action';
end;
$$;

create or replace function public.finalize_seller_rejection_after_refund()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.seller_rejection_requested_at is not null
     and new.payment_status='refunded'
     and new.status in ('accepted','paid')
     and coalesce(new.amount_refunded,0) >= coalesce(new.amount_paid,0)
     and coalesce(new.amount_paid,0) > 0 then
    update public.catalog_order_requests
      set status='cancelled',
          notes=concat_ws(E'\n',nullif(new.notes,''),'Seller cancellation refund completed.'),
          updated_at=now()
      where id=new.id and status in ('accepted','paid');
  end if;
  return new;
end;
$$;

drop trigger if exists finalize_seller_rejection_after_refund_trigger on public.catalog_order_requests;
create trigger finalize_seller_rejection_after_refund_trigger
after update of payment_status,amount_refunded on public.catalog_order_requests
for each row execute function public.finalize_seller_rejection_after_refund();

-- 4) Let a seller initiate an order-linked conversation as well as reply to one.
drop policy if exists disputes_seller_create on public.disputes;
create policy disputes_seller_create
on public.disputes for insert to authenticated
with check (
  seller_id = public.my_seller_id()
  and status='open'
  and resolution_notes is null
  and resolved_at is null
  and dispute_type='general_query'
  and catalog_order_id is not null
  and exists (
    select 1 from public.catalog_order_requests o
    where o.id=catalog_order_id and o.seller_id=public.my_seller_id()
      and o.buyer_id=buyer_user_id
  )
);

-- Refresh the seller-facing/buyer-facing notification semantics for direct stock confirmation.
create or replace function public.emit_catalog_order_notifications()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare seller_user_id uuid; product_name text; amount_text text;
begin
  select sp.user_id into seller_user_id from public.seller_profiles sp where sp.id=new.seller_id;
  select p.name into product_name from public.seller_products p where p.id=new.product_id;
  product_name:=coalesce(product_name,'Marketplace product');
  amount_text:='₹'||to_char(coalesce(new.total_amount,0),'FM999999990.00');

  if tg_op='INSERT' then
    if new.status='accepted' then
      if seller_user_id is not null then
        insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
        values(seller_user_id,'seller','new_order','New stock-confirmed order',product_name||' · '||new.quantity||' '||new.unit||' · '||amount_text,'/seller-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':new_order',jsonb_build_object('productName',product_name,'quantity',new.quantity,'unit',new.unit,'totalAmount',new.total_amount)) on conflict(dedupe_key) do nothing;
      end if;
      insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
      values(new.buyer_id,'buyer','order_accepted','Stock confirmed — payment ready',product_name||' is reserved from live stock · '||amount_text,'/buyer-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':accepted',jsonb_build_object('productName',product_name,'totalAmount',new.total_amount)) on conflict(dedupe_key) do nothing;
    elsif new.requires_review then
      insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
      values(new.buyer_id,'buyer','order_review','Company review required',product_name||' is reserved while your company review is pending.','/buyer-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':company_review',jsonb_build_object('productName',product_name)) on conflict(dedupe_key) do nothing;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status='accepted' then
      if seller_user_id is not null then
        insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
        values(seller_user_id,'seller','new_order','New stock-confirmed order',product_name||' · '||new.quantity||' '||new.unit||' · '||amount_text,'/seller-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':new_order',jsonb_build_object('productName',product_name,'totalAmount',new.total_amount)) on conflict(dedupe_key) do nothing;
      end if;
      insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
      values(new.buyer_id,'buyer','order_accepted','Stock confirmed — payment ready',product_name||' is ready for payment · '||amount_text,'/buyer-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':accepted',jsonb_build_object('productName',product_name,'totalAmount',new.total_amount)) on conflict(dedupe_key) do nothing;
    elsif new.status in ('rejected','cancelled') then
      insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
      values(new.buyer_id,'buyer','order_rejected',case when new.payment_status='refunded' then 'Order cancelled and refunded' else 'Order cancelled' end,product_name||case when new.payment_status='refunded' then ' was cancelled by the seller and the captured payment was refunded.' else ' was cancelled before fulfilment.' end,'/buyer-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':cancelled',jsonb_build_object('productName',product_name,'reason',new.seller_rejection_reason)) on conflict(dedupe_key) do nothing;
    elsif new.status='fulfilled' then
      insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
      values(new.buyer_id,'buyer','order_fulfilled','Order fulfilled',product_name||' has been delivered and fulfilled.','/buyer-dashboard?tab=tracking&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':fulfilled',jsonb_build_object('productName',product_name)) on conflict(dedupe_key) do nothing;
    end if;
  end if;

  if new.payment_status is distinct from old.payment_status and new.payment_status='paid' and seller_user_id is not null then
    insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
    values(seller_user_id,'seller','payment_received','Payment received — ship this order',product_name||' is fully paid · '||amount_text,'/seller-dashboard?tab=orders&order='||new.id,'catalog_order',new.id,'catalog:'||new.id||':paid',jsonb_build_object('productName',product_name,'totalAmount',new.total_amount)) on conflict(dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
