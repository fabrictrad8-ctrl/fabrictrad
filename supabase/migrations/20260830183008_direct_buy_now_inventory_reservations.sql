create or replace function public.expire_direct_catalog_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  update public.catalog_order_requests
     set status = 'cancelled',
         notes = concat_ws(E'\n', nullif(notes,''), 'Automatic cancellation: unpaid checkout reservation expired.'),
         updated_at = now()
   where status = 'accepted'
     and payment_status in ('unpaid','failed')
     and coalesce(amount_paid,0) <= 0
     and created_at < now() - interval '30 minutes';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.buy_catalog_now(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity numeric,
  p_company_id uuid default null,
  p_company_location_id uuid default null,
  p_purchase_order_number text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing public.catalog_order_requests%rowtype;
  result jsonb;
  created_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  perform public.expire_direct_catalog_orders();

  select * into existing
  from public.catalog_order_requests
  where buyer_id=current_user_id
    and product_id=p_product_id
    and variant_id is not distinct from p_variant_id
    and status='accepted'
    and payment_status in ('unpaid','failed')
    and coalesce(amount_paid,0) <= 0
  order by created_at desc
  limit 1
  for update;

  if found and existing.quantity is distinct from p_quantity then
    update public.catalog_order_requests
       set status='cancelled',
           notes=concat_ws(E'\n',nullif(notes,''),'Checkout quantity changed; previous stock reservation released.'),
           updated_at=now()
     where id=existing.id;
  elsif found then
    update public.catalog_order_requests
       set payment_due_at=now()+interval '30 minutes', updated_at=now()
     where id=existing.id;
    return jsonb_build_object(
      'id',existing.id,'orderRef',existing.id,'existing',true,
      'status','accepted','paymentStatus',existing.payment_status,
      'requiresReview',false,'reviewStatus','not_required',
      'buyerType',existing.buyer_type,'quantity',existing.quantity,'unit',existing.unit,
      'pricePerUnit',existing.price_per_unit,'subtotal',existing.subtotal,
      'gstAmount',existing.gst_amount,'totalAmount',existing.total_amount,
      'invoiceType',existing.tax_invoice_type,'inputTaxCreditPossible',existing.input_tax_credit_possible,
      'taxNote',existing.tax_note,'reservationExpiresAt',now()+interval '30 minutes'
    );
  end if;

  result := public.submit_catalog_order_request(
    p_product_id,
    p_variant_id,
    p_quantity,
    p_company_id,
    p_company_location_id,
    p_purchase_order_number,
    'due_on_order',
    0,
    false,
    coalesce(nullif(trim(p_notes),''),'Direct Buy Now checkout')
  );

  created_id := nullif(result->>'id','')::uuid;
  if created_id is not null then
    update public.catalog_order_requests
       set payment_due_at=now()+interval '30 minutes', updated_at=now()
     where id=created_id and buyer_id=current_user_id and status='accepted';
  end if;
  return result || jsonb_build_object('reservationExpiresAt',now()+interval '30 minutes');
end;
$$;

grant execute on function public.buy_catalog_now(uuid,uuid,numeric,uuid,uuid,text,text) to authenticated;
grant execute on function public.expire_direct_catalog_orders() to authenticated;
