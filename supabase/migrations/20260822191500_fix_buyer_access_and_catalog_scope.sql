-- Keep sale-channel flags and buyer quantity controls consistent, and ensure
-- database-priced Retail Store orders see all-buyer catalogues.

alter table public.seller_products
  alter column end_user_enabled set default true,
  alter column end_user_limit_mode set default 'custom',
  alter column end_user_min_quantity set default 1;

create or replace function public.normalize_seller_product_buyer_access()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sale_channel = 'b2b' then
    new.end_user_enabled := false;
    new.end_user_limit_mode := 'disabled';
    new.end_user_min_quantity := null;
    new.end_user_max_quantity := null;
  elsif new.sale_channel in ('retail', 'both') then
    if coalesce(new.end_user_enabled, true) = false or new.end_user_limit_mode = 'disabled' then
      new.sale_channel := 'b2b';
      new.end_user_enabled := false;
      new.end_user_limit_mode := 'disabled';
      new.end_user_min_quantity := null;
      new.end_user_max_quantity := null;
    else
      new.end_user_enabled := true;
      new.end_user_limit_mode := coalesce(nullif(new.end_user_limit_mode, 'disabled'), 'custom');
      if new.end_user_limit_mode = 'custom' and new.end_user_min_quantity is null then
        new.end_user_min_quantity := 1;
      end if;
    end if;
  end if;

  new.retail_store_min_quantity := coalesce(
    new.retail_store_min_quantity,
    greatest(coalesce(new.moq, 1), 1)
  );
  return new;
end;
$$;

drop trigger if exists seller_products_normalize_buyer_access on public.seller_products;
create trigger seller_products_normalize_buyer_access
before insert or update of sale_channel, end_user_enabled, end_user_limit_mode,
  end_user_min_quantity, end_user_max_quantity, retail_store_min_quantity, moq
on public.seller_products
for each row execute function public.normalize_seller_product_buyer_access();

update public.seller_products
set end_user_enabled = true,
    end_user_limit_mode = case
      when end_user_limit_mode = 'disabled' then 'custom'
      else coalesce(end_user_limit_mode, 'custom')
    end,
    end_user_min_quantity = coalesce(end_user_min_quantity, 1),
    retail_store_min_quantity = coalesce(
      retail_store_min_quantity,
      greatest(coalesce(moq, 1), 1)
    ),
    updated_at = now()
where sale_channel in ('retail', 'both')
  and (
    end_user_enabled is not true
    or end_user_limit_mode = 'disabled'
    or (end_user_limit_mode = 'custom' and end_user_min_quantity is null)
  );

create or replace function public.enforce_catalog_order_policy_and_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer public.buyer_profiles%rowtype;
  buyer_user public.user_profiles%rowtype;
  seller public.seller_profiles%rowtype;
  seller_user public.user_profiles%rowtype;
  product public.seller_products%rowtype;
  variant public.seller_product_variants%rowtype;
  rule public.seller_catalog_rules%rowtype;
  effective_min numeric;
  effective_max numeric;
  effective_mode text;
  effective_end_user_enabled boolean;
  effective_price numeric;
  effective_gst_rate numeric;
  effective_price_includes_gst boolean;
  available_to_sell numeric;
  buyer_state text;
  seller_state text;
  tax_total numeric;
  break_price numeric;
begin
  select * into buyer
  from public.buyer_profiles
  where user_id = new.buyer_id and is_active = true;
  if not found then raise exception 'Active buyer profile not found'; end if;

  select * into buyer_user
  from public.user_profiles
  where id = new.buyer_id and is_active = true;
  if not found or coalesce(buyer_user.can_buy, false) = false then
    raise exception 'Buying access is not enabled';
  end if;

  select * into product
  from public.seller_products
  where id = new.product_id and status = 'active' and approval_status = 'approved';
  if not found then raise exception 'Product is not available for ordering'; end if;

  if new.variant_id is not null then
    select * into variant
    from public.seller_product_variants
    where id = new.variant_id
      and product_id = product.id
      and status = 'active'
      and approval_status = 'approved';
    if not found then raise exception 'Product variation is not available'; end if;
  else
    variant := null;
  end if;

  select * into seller
  from public.seller_profiles
  where id = product.seller_id and is_active = true;
  if not found then raise exception 'Seller profile is not active'; end if;

  select * into seller_user
  from public.user_profiles
  where id = seller.user_id;

  new.seller_id := product.seller_id;
  new.buyer_type := buyer.buyer_type;
  new.unit := coalesce(variant.unit, product.unit);
  available_to_sell := greatest(
    coalesce(variant.available_quantity, product.available_quantity)
      - coalesce(variant.reserved_quantity, product.reserved_quantity),
    0
  );
  if new.quantity <= 0 or new.quantity > available_to_sell then
    raise exception 'Requested quantity is outside the available stock';
  end if;

  if buyer.buyer_type = 'end_user' then
    if product.sale_channel not in ('retail', 'both') then
      raise exception 'This listing is available only to business buyers';
    end if;
    effective_end_user_enabled := coalesce(
      variant.end_user_enabled,
      product.end_user_enabled,
      false
    );
    effective_mode := coalesce(
      variant.end_user_limit_mode,
      product.end_user_limit_mode,
      'disabled'
    );
    if not effective_end_user_enabled or effective_mode = 'disabled' then
      raise exception 'Personal purchases are disabled for this listing';
    end if;
    if effective_mode = 'same_as_retail_store' then
      effective_min := coalesce(
        variant.retail_store_min_quantity,
        product.retail_store_min_quantity,
        variant.moq,
        product.moq,
        1
      );
      effective_max := coalesce(
        variant.retail_store_max_quantity,
        product.retail_store_max_quantity
      );
    else
      effective_min := coalesce(
        variant.end_user_min_quantity,
        product.end_user_min_quantity,
        1
      );
      effective_max := coalesce(
        variant.end_user_max_quantity,
        product.end_user_max_quantity
      );
    end if;
  else
    if product.sale_channel = 'retail' then
      raise exception 'This listing is available only to personal buyers';
    end if;
    effective_min := coalesce(
      variant.retail_store_min_quantity,
      product.retail_store_min_quantity,
      variant.moq,
      product.moq,
      1
    );
    effective_max := coalesce(
      variant.retail_store_max_quantity,
      product.retail_store_max_quantity
    );
  end if;

  if new.quantity < greatest(effective_min, 0) then
    raise exception 'Minimum permitted quantity is % %', effective_min, new.unit;
  end if;
  if effective_max is not null and new.quantity > effective_max then
    raise exception 'Maximum permitted quantity is % %', effective_max, new.unit;
  end if;

  rule := null;
  if buyer.buyer_type = 'retail_store' then
    select r.* into rule
    from public.seller_catalog_rules r
    join public.seller_catalogs c on c.id = r.catalog_id
    where r.product_id = product.id
      and (r.variant_id is null or r.variant_id = new.variant_id)
      and c.seller_id = product.seller_id
      and c.status = 'active'
      and (
        c.scope = 'all_buyers'
        or (c.scope = 'company' and c.company_id = new.company_id)
      )
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
    order by
      (r.variant_id is not null) desc,
      (c.company_id is not null) desc,
      r.updated_at desc
    limit 1;
  end if;

  if rule.id is not null then
    if new.quantity < rule.minimum_quantity then
      raise exception 'Catalog minimum quantity is % %', rule.minimum_quantity, new.unit;
    end if;
    if rule.maximum_quantity is not null and new.quantity > rule.maximum_quantity then
      raise exception 'Catalog maximum quantity is % %', rule.maximum_quantity, new.unit;
    end if;
    effective_price := coalesce(
      rule.price_override,
      variant.price_per_unit,
      product.price_per_unit
    );
    select (entry->>'price')::numeric into break_price
    from jsonb_array_elements(coalesce(rule.price_breaks, '[]'::jsonb)) entry
    where (entry->>'minimum_quantity')::numeric <= new.quantity
    order by (entry->>'minimum_quantity')::numeric desc
    limit 1;
    effective_price := coalesce(break_price, effective_price);
  else
    effective_price := coalesce(variant.price_per_unit, product.price_per_unit);
  end if;

  effective_gst_rate := coalesce(variant.gst_rate, product.gst_rate, 0);
  effective_price_includes_gst := coalesce(
    variant.price_includes_gst,
    product.price_includes_gst,
    false
  );
  new.price_per_unit := round(effective_price, 2);
  new.subtotal := round(new.quantity * effective_price, 2);
  new.gst_rate := effective_gst_rate;
  new.price_includes_gst := effective_price_includes_gst;
  new.hsn_code := product.hsn_code;

  if effective_price_includes_gst and effective_gst_rate > 0 then
    tax_total := round(
      new.subtotal - (new.subtotal / (1 + effective_gst_rate / 100)),
      2
    );
    new.total_amount := new.subtotal;
  else
    tax_total := round(new.subtotal * effective_gst_rate / 100, 2);
    new.total_amount := round(new.subtotal + tax_total, 2);
  end if;
  new.gst_amount := tax_total;

  new.buyer_gstin := case
    when buyer.gstin_status = 'active' then buyer.gstin
    else null
  end;
  new.buyer_gstin_verified := buyer.gstin_status = 'active';
  new.seller_gstin := case
    when seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false)
      then seller.gstin
    else null
  end;
  new.seller_gstin_verified :=
    seller.gstin_status = 'active' or coalesce(seller.gstin_verified, false);
  new.tax_invoice_type := case
    when buyer.buyer_type = 'retail_store' and new.buyer_gstin_verified then 'b2b'
    else 'b2c'
  end;
  new.input_tax_credit_possible :=
    new.tax_invoice_type = 'b2b' and new.seller_gstin_verified and tax_total > 0;

  buyer_state := coalesce(buyer.billing_address->>'state', buyer_user.state);
  seller_state := coalesce(seller.pickup_address->>'state', seller_user.state);
  new.place_of_supply_state := buyer_state;
  new.intra_state_supply :=
    buyer_state is not null
    and seller_state is not null
    and lower(trim(buyer_state)) = lower(trim(seller_state));

  if new.intra_state_supply then
    new.cgst_amount := round(tax_total / 2, 2);
    new.sgst_amount := tax_total - new.cgst_amount;
    new.igst_amount := 0;
  else
    new.cgst_amount := 0;
    new.sgst_amount := 0;
    new.igst_amount := tax_total;
  end if;

  new.tax_note := case
    when new.input_tax_credit_possible then
      'GST charged on the tax invoice. The registered buyer may claim eligible input tax credit subject to GST law and return matching.'
    when new.tax_invoice_type = 'b2b' then
      'Buyer GSTIN recorded. Input tax credit depends on seller GST status, invoice validity and statutory conditions.'
    else
      'Consumer invoice. GST, where applicable, remains payable and is not removed by entering a GSTIN.'
  end;
  return new;
end;
$$;
