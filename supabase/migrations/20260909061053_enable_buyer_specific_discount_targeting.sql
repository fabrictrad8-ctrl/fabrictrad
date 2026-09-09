-- Reconstructed from the applied live migration 20260909061053_enable_buyer_specific_discount_targeting.
-- Buyer-specific campaigns now have real targeting data (target_product_key
-- stores the resolved buyer account id, set by the admin API from the email
-- the admin enters). Add it to the auto-apply eligibility set - previously
-- excluded because there was no way to know which buyer it targeted.
create or replace function public.resolve_active_discount(
  p_product_id uuid,
  p_seller_id uuid,
  p_category text,
  p_buyer_id uuid,
  p_gross_subtotal numeric,
  p_discount_code text
) returns table(campaign_id uuid, discount_amount numeric)
language plpgsql
security definer
set search_path to ''
as $$
declare
  candidate public.discount_campaigns%rowtype;
  computed_amount numeric;
  today date := current_date;
begin
  if p_discount_code is not null and length(trim(p_discount_code)) > 0 then
    select * into candidate
    from public.discount_campaigns c
    where lower(c.code) = lower(trim(p_discount_code))
      and c.campaign_type = 'Coupon Code'
      and c.status <> 'paused'
      and today between c.start_date and c.end_date
      and c.min_order_value <= p_gross_subtotal
      and (c.usage_limit is null or c.usage_count < c.usage_limit)
    for update;

    if not found then
      raise exception 'This discount code is invalid, expired, or no longer applies to this order' using errcode = 'FT001';
    end if;
  else
    select * into candidate
    from public.discount_campaigns c
    where c.status <> 'paused'
      and today between c.start_date and c.end_date
      and c.min_order_value <= p_gross_subtotal
      and (c.usage_limit is null or c.usage_count < c.usage_limit)
      and (
        (c.campaign_type = 'Website-wide')
        or (c.campaign_type = 'Product-specific' and c.target_product_key = p_product_id::text)
        or (c.campaign_type = 'Category' and c.target_product_key = p_category)
        or (c.campaign_type = 'Seller-specific' and c.target_product_key = p_seller_id::text)
        or (c.campaign_type = 'Buyer-specific' and c.target_product_key = p_buyer_id::text)
        or (c.campaign_type in ('Flash Sale', 'Festival Offer'))
        or (
          c.campaign_type = 'First-order'
          and not exists (
            select 1 from public.catalog_order_requests o
            where o.buyer_id = p_buyer_id and o.status in ('paid', 'fulfilled')
          )
        )
      )
    order by c.discount_percent desc
    limit 1
    for update;
  end if;

  if candidate.id is null then
    return query select null::uuid, 0::numeric;
    return;
  end if;

  computed_amount := round(p_gross_subtotal * candidate.discount_percent / 100, 2);
  if candidate.max_discount is not null then
    computed_amount := least(computed_amount, candidate.max_discount);
  end if;
  computed_amount := least(computed_amount, round(p_gross_subtotal - 0.01, 2));
  computed_amount := greatest(computed_amount, 0);

  update public.discount_campaigns
  set usage_count = usage_count + 1, updated_at = now()
  where id = candidate.id;

  return query select candidate.id, computed_amount;
end;
$$;

revoke execute on function public.resolve_active_discount(uuid, uuid, text, uuid, numeric, text) from public, anon, authenticated;
