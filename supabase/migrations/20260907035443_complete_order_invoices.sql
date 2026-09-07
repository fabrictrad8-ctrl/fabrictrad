-- All marketplace order types share immutable, private billing documents.
-- No historical orders are issued or emailed by this migration.
alter table public.seller_tax_invoices
  add column bespoke_order_id uuid references public.bespoke_orders(id) on delete restrict,
  add column bespoke_payment_id uuid references public.bespoke_payments(id) on delete restrict,
  add column document_type text not null default 'tax_invoice'
    check (document_type in ('tax_invoice','bill_of_supply','payment_receipt')),
  add column document_metadata jsonb not null default '{}'::jsonb;
alter table public.seller_tax_invoices drop constraint seller_tax_invoices_order_source_check;
alter table public.seller_tax_invoices add constraint seller_tax_invoices_order_source_check
  check (num_nonnulls(catalog_order_id,bulk_order_id,bespoke_order_id)=1);
alter table public.seller_tax_invoices add constraint seller_tax_invoices_receipt_source_check
  check ((document_type='payment_receipt' and bespoke_order_id is not null and bespoke_payment_id is not null)
    or (document_type<>'payment_receipt' and bespoke_payment_id is null));
create unique index seller_tax_invoices_bespoke_final_key on public.seller_tax_invoices(bespoke_order_id)
  where bespoke_order_id is not null and document_type<>'payment_receipt';
create unique index seller_tax_invoices_bespoke_receipt_key on public.seller_tax_invoices(bespoke_payment_id)
  where bespoke_payment_id is not null;
-- Keep existing buyer/seller/admin SELECT policies, remove direct browser mutation paths.
revoke insert, update, delete, truncate, references, trigger on public.seller_tax_invoices from anon, authenticated;
revoke all on public.seller_tax_invoices from anon;
grant select on public.seller_tax_invoices to authenticated;
grant all on public.seller_tax_invoices to service_role;

alter table public.bespoke_payments add column invoice_quote jsonb not null default '{}'::jsonb;

create or replace function public.valid_bespoke_invoice_details(details jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(
    jsonb_typeof(details)='object'
    and length(trim(details->>'description')) between 3 and 500
    and details->>'hsnCode' ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$'
    and details->>'supplyType' in ('goods','services')
    and jsonb_typeof(details->'gstRate')='number'
    and case when jsonb_typeof(details->'gstRate')='number' then
      (details->>'gstRate')::numeric between 0 and 100
      and (details->>'gstRate')::numeric = round((details->>'gstRate')::numeric,2)
    else false end, false);
$$;
revoke all on function public.valid_bespoke_invoice_details(jsonb) from public, anon, authenticated;
grant execute on function public.valid_bespoke_invoice_details(jsonb) to service_role;

create or replace function public.capture_bespoke_invoice_quote()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare o public.bespoke_orders%rowtype;
begin
  select * into o from public.bespoke_orders where id=new.bespoke_order_id for update;
  if not public.valid_bespoke_invoice_details(o.quotation->'invoice') then
    raise exception 'Complete the quotation description, HSN/SAC, supply type and GST rate before checkout';
  end if;
  if new.user_id<>o.user_id or new.amount>o.quoted_amount then
    raise exception 'Payment does not match the custom order quotation';
  end if;
  new.invoice_quote := jsonb_build_object('invoice',o.quotation->'invoice','quotedAmount',o.quoted_amount);
  return new;
end;
$$;
revoke all on function public.capture_bespoke_invoice_quote() from public, anon, authenticated;
create trigger bespoke_payments_invoice_quote before insert on public.bespoke_payments
  for each row execute function public.capture_bespoke_invoice_quote();

create or replace function public.protect_bespoke_invoice_quote()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (new.quoted_amount is distinct from old.quoted_amount or new.advance_amount is distinct from old.advance_amount
      or new.seller_id is distinct from old.seller_id
      or (new.quotation->'invoice' is distinct from old.quotation->'invoice' and public.valid_bespoke_invoice_details(old.quotation->'invoice')))
    and exists(select 1 from public.bespoke_payments where bespoke_order_id=old.id and status<>'failed') then
    raise exception 'The financial quotation and seller are locked after checkout starts';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_bespoke_invoice_quote() from public, anon, authenticated;
create trigger bespoke_orders_invoice_quote before update on public.bespoke_orders
  for each row execute function public.protect_bespoke_invoice_quote();

create or replace function public.issue_paid_catalog_tax_invoice_system(
  p_catalog_order_id uuid,
  p_payment_reference text,
  p_payment_captured_at timestamptz default now()
)
returns public.seller_tax_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.catalog_order_requests%rowtype;
  seller_row public.seller_profiles%rowtype;
  seller_user_row public.user_profiles%rowtype;
  buyer_row public.user_profiles%rowtype;
  product_row public.seller_products%rowtype;
  payment_row public.catalog_order_payments%rowtype;
  existing_invoice public.seller_tax_invoices%rowtype;
  invoice_row public.seller_tax_invoices%rowtype;
  sequence_number integer;
  fy_start integer;
  v_financial_year text;
  generated_invoice_number text;
  supplier_payload jsonb;
  recipient_payload jsonb;
  delivery_payload jsonb;
  line_payload jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required for automatic invoice generation' using errcode = '42501';
  end if;

  select * into order_row from public.catalog_order_requests where id = p_catalog_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into existing_invoice from public.seller_tax_invoices where catalog_order_id = p_catalog_order_id;
  if found then return existing_invoice; end if;

  if order_row.payment_status <> 'paid' or order_row.status not in ('paid', 'fulfilled') then
    raise exception 'The catalogue order must be fully paid before automatic invoice generation';
  end if;

  select * into payment_row
  from public.catalog_order_payments
  where catalog_order_id = order_row.id
    and razorpay_payment_id = p_payment_reference
    and currency = 'INR'
    and status in ('captured','partially_refunded','refunded')
    and razorpay_payment_id is not null
  order by captured_at desc nulls last, created_at desc
  limit 1;
  if not found then raise exception 'Captured Razorpay payment evidence is missing'; end if;
  if (select round(coalesce(sum(coalesce(p.captured_amount, p.amount)),0),2) from public.catalog_order_payments p where p.catalog_order_id=order_row.id and p.currency='INR' and p.status in ('captured','partially_refunded','refunded')) <> round(order_row.total_amount, 2) then
    raise exception 'Captured payment amount does not match the invoice total';
  end if;

  select * into seller_row from public.seller_profiles where id = order_row.seller_id for update;
  if not found
     or seller_row.is_active is distinct from true
     or seller_row.gstin_verified is distinct from true
     or seller_row.verification_status::text not in ('approved','verified','active') then
    raise exception 'An active GST-verified seller is required before issuing an invoice';
  end if;
  if seller_row.e_invoice_applicable is true and nullif(trim(order_row.buyer_gstin),'') is not null and order_row.gst_rate>0 then
    raise exception 'E_INVOICE_IRN_REQUIRED: automatic GST invoice is waiting for IRN and signed QR data';
  end if;

  select * into seller_user_row from public.user_profiles where id = seller_row.user_id;
  if not found then raise exception 'Seller account profile is unavailable'; end if;
  select * into buyer_row from public.user_profiles where id = order_row.buyer_id;
  if not found then raise exception 'Buyer account profile is unavailable'; end if;
  select * into product_row from public.seller_products where id = order_row.product_id;
  if not found then raise exception 'Product snapshot source is unavailable'; end if;
  if trim(coalesce(nullif(order_row.hsn_code, ''), product_row.hsn_code, '')) !~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$' then
    raise exception 'HSN_REQUIRED: add a valid HSN code to the product before issuing its GST invoice';
  end if;

  fy_start := case when extract(month from now() at time zone 'Asia/Kolkata') >= 4 then extract(year from now() at time zone 'Asia/Kolkata')::integer else extract(year from now() at time zone 'Asia/Kolkata')::integer - 1 end;
  v_financial_year := right(fy_start::text, 2) || '-' || right((fy_start + 1)::text, 2);
  insert into public.seller_invoice_sequences (seller_id, financial_year, last_number)
  values (seller_row.id, v_financial_year, 1)
  on conflict (seller_id, financial_year)
  do update set last_number = public.seller_invoice_sequences.last_number + 1, updated_at = now()
  returning last_number into sequence_number;
  generated_invoice_number := 'FT/' || v_financial_year || '/' || lpad(sequence_number::text, 6, '0');

  supplier_payload := jsonb_build_object(
    'legalName', seller_row.legal_business_name,
    'tradeName', coalesce(seller_row.display_name, seller_row.legal_business_name),
    'gstin', seller_row.gstin,
    'address', coalesce(seller_row.pickup_address, '{}'::jsonb),
    'email', seller_user_row.email,
    'phone', seller_user_row.phone
  );
  recipient_payload := jsonb_build_object(
    'name', buyer_row.full_name,
    'businessName', buyer_row.business_name,
    'gstin', order_row.buyer_gstin,
    'email', buyer_row.email,
    'phone', buyer_row.phone,
    'addressLine1', buyer_row.address_line1,
    'addressLine2', buyer_row.address_line2,
    'city', buyer_row.city,
    'state', buyer_row.state,
    'pincode', buyer_row.pincode
  );
  delivery_payload := jsonb_build_object(
    'addressLine1', buyer_row.address_line1,
    'addressLine2', buyer_row.address_line2,
    'city', buyer_row.city,
    'state', buyer_row.state,
    'pincode', buyer_row.pincode
  );
  line_payload := jsonb_build_array(jsonb_build_object(
    'description', product_row.name,
    'sku', product_row.sku,
    'hsnCode', coalesce(nullif(order_row.hsn_code, ''), product_row.hsn_code),
    'quantity', order_row.quantity,
    'unit', order_row.unit,
    'unitPrice', order_row.price_per_unit,
    'taxableValue', order_row.subtotal,
    'gstRate', order_row.gst_rate,
    'cgstAmount', order_row.cgst_amount,
    'sgstAmount', order_row.sgst_amount,
    'igstAmount', order_row.igst_amount,
    'cessAmount', 0,
    'lineTotal', order_row.total_amount
  ));

  insert into public.seller_tax_invoices (
    seller_id, buyer_user_id, catalog_order_id, bulk_order_id,
    invoice_number, financial_year, issued_by_user_id, status,
    supplier, recipient, delivery_address, place_of_supply, reverse_charge, lines,
    subtotal, discount, taxable_value, cgst_amount, sgst_amount, igst_amount,
    cess_amount, total_tax, total_amount, currency, payment_reference,
    payment_captured_at, e_invoice_applicable, generation_source,
    email_status, email_recipient, document_type
  ) values (
    seller_row.id, order_row.buyer_id, order_row.id, null,
    generated_invoice_number, v_financial_year, seller_row.user_id, 'issued',
    supplier_payload, recipient_payload, delivery_payload,
    coalesce(order_row.place_of_supply_state, buyer_row.state), false, line_payload,
    order_row.subtotal, 0, order_row.subtotal, order_row.cgst_amount,
    order_row.sgst_amount, order_row.igst_amount, 0, order_row.gst_amount,
    order_row.total_amount, 'INR', payment_row.razorpay_payment_id,
    coalesce(payment_row.captured_at, p_payment_captured_at, now()), false,
    'automatic_payment_capture', 'pending', buyer_row.email, case when coalesce(order_row.gst_rate, 0) = 0 then 'bill_of_supply' else 'tax_invoice' end
  ) returning * into invoice_row;

  insert into public.commerce_notifications (
    user_id, audience, kind, title, message, action_url, entity_type, entity_id, dedupe_key, metadata
  ) values (
    order_row.buyer_id, 'buyer', 'invoice_issued', 'Invoice generated',
    'Your GST invoice ' || generated_invoice_number || ' has been generated after payment capture.',
    '/buyer-dashboard', 'seller_tax_invoice', invoice_row.id,
    'invoice-issued-' || invoice_row.id::text,
    jsonb_build_object('invoiceNumber', generated_invoice_number, 'orderId', order_row.id, 'totalAmount', order_row.total_amount)
  ) on conflict (dedupe_key) do nothing;

  return invoice_row;
end;
$$;

create or replace function public.issue_paid_bulk_tax_invoice_system(
  p_bulk_order_id uuid,
  p_payment_reference text,
  p_payment_captured_at timestamptz default now()
)
returns public.seller_tax_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.bulk_orders%rowtype;
  seller_row public.seller_profiles%rowtype;
  seller_user_row public.user_profiles%rowtype;
  buyer_row public.user_profiles%rowtype;
  payment_row public.bulk_order_payments%rowtype;
  existing_invoice public.seller_tax_invoices%rowtype;
  invoice_row public.seller_tax_invoices%rowtype;
  sequence_number integer;
  fy_start integer;
  v_financial_year text;
  generated_invoice_number text;
  supplier_payload jsonb;
  recipient_payload jsonb;
  delivery_payload jsonb;
  line_payload jsonb;
  missing_hsn boolean;
  buyer_state text;
  seller_state text;
  intra_state boolean;
  computed_cgst numeric := 0;
  computed_sgst numeric := 0;
  computed_igst numeric := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required for automatic invoice generation' using errcode = '42501';
  end if;

  select * into order_row from public.bulk_orders where id = p_bulk_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into existing_invoice from public.seller_tax_invoices where bulk_order_id = p_bulk_order_id;
  if found then return existing_invoice; end if;

  if order_row.payment_status <> 'paid' or order_row.status not in ('paid','shipped','delivered') then
    raise exception 'The bulk order must be fully paid before automatic invoice generation';
  end if;

  select * into payment_row
  from public.bulk_order_payments
  where bulk_order_id = order_row.id
    and razorpay_payment_id = p_payment_reference
    and currency = 'INR'
    and status in ('captured','partially_refunded','refunded')
    and razorpay_payment_id is not null
  order by captured_at desc nulls last, created_at desc
  limit 1;
  if not found then raise exception 'Captured Razorpay payment evidence is missing'; end if;
  if (select round(coalesce(sum(coalesce(p.captured_amount, p.amount)),0),2) from public.bulk_order_payments p where p.bulk_order_id=order_row.id and p.currency='INR' and p.status in ('captured','partially_refunded','refunded')) <> round(order_row.net_total, 2) then
    raise exception 'Captured payment amount does not match the invoice total';
  end if;

  select * into seller_row from public.seller_profiles where id = order_row.seller_id for update;
  if not found
     or seller_row.is_active is distinct from true
     or seller_row.gstin_verified is distinct from true
     or seller_row.verification_status::text not in ('approved','verified','active') then
    raise exception 'An active GST-verified seller is required before issuing an invoice';
  end if;
  if seller_row.e_invoice_applicable is true and nullif(trim(order_row.buyer_gstin),'') is not null and order_row.gst_total>0 then
    raise exception 'E_INVOICE_IRN_REQUIRED: automatic GST invoice is waiting for IRN and signed QR data';
  end if;

  select * into seller_user_row from public.user_profiles where id = seller_row.user_id;
  if not found then raise exception 'Seller account profile is unavailable'; end if;
  select * into buyer_row from public.user_profiles where id = order_row.buyer_id;
  if not found then raise exception 'Buyer account profile is unavailable'; end if;

  select exists (
    select 1
    from public.bulk_order_items i
    left join public.seller_products p on p.seller_id = seller_row.id and p.sku = i.sku
    where i.bulk_order_id = order_row.id
      and trim(coalesce(p.hsn_code, '')) !~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$'
  ) into missing_hsn;
  if missing_hsn then
    raise exception 'HSN_REQUIRED: every bulk-order item must map to a seller product with a valid HSN code';
  end if;

  if exists(select 1 from public.bulk_order_items where bulk_order_id=order_row.id
    and (gst_rate is null or gst_rate<0 or gst_rate>100 or discount_pct<0 or discount_pct>100 or price_per_mtr<=0)) then
    raise exception 'Every bulk line needs a valid price, discount and GST rate';
  end if;
  buyer_state := buyer_row.state;
  seller_state := coalesce(seller_row.pickup_address->>'state', seller_user_row.state);
  if nullif(trim(buyer_state), '') is null or nullif(trim(seller_state), '') is null then
    raise exception 'Supplier and recipient states are required for GST';
  end if;
  intra_state := lower(trim(buyer_state)) = lower(trim(seller_state));
  with amounts as (
    select i.*, p.hsn_code,
      round(i.price_per_mtr * i.quantity_mtrs, 2) as gross,
      round(round(i.price_per_mtr * i.quantity_mtrs, 2) * coalesce(i.discount_pct, 0) / 100, 2) as saving
    from public.bulk_order_items i
    join public.seller_products p on p.seller_id = seller_row.id and p.sku = i.sku
    where i.bulk_order_id = order_row.id
  ), taxes as (
    select *, gross - saving as taxable, round((gross - saving) * coalesce(gst_rate, 0) / 100, 2) as tax from amounts
  )
  select jsonb_agg(jsonb_build_object(
    'description', product_name, 'sku', sku, 'hsnCode', hsn_code,
    'quantity', quantity_mtrs, 'unit', 'mtr', 'unitPrice', price_per_mtr,
    'discountPct', discount_pct, 'discountAmount', saving, 'taxableValue', taxable,
    'gstRate', gst_rate,
    'cgstAmount', case when intra_state then round(tax / 2, 2) else 0 end,
    'sgstAmount', case when intra_state then tax - round(tax / 2, 2) else 0 end,
    'igstAmount', case when intra_state then 0 else tax end, 'cessAmount', 0,
    'lineTotal', taxable + tax
  ) order by created_at, id) into line_payload from taxes;
  if line_payload is null or jsonb_array_length(line_payload) = 0 then
    raise exception 'Bulk order has no invoiceable line items';
  end if;
  select sum((l->>'cgstAmount')::numeric), sum((l->>'sgstAmount')::numeric), sum((l->>'igstAmount')::numeric)
    into computed_cgst, computed_sgst, computed_igst from jsonb_array_elements(line_payload) l;
  if (select sum((l->>'lineTotal')::numeric) from jsonb_array_elements(line_payload) l) <> round(order_row.net_total, 2)
    or computed_cgst + computed_sgst + computed_igst <> round(coalesce(order_row.gst_total, 0), 2)
    or (select sum((l->>'taxableValue')::numeric) from jsonb_array_elements(line_payload) l) <> round(order_row.gross_total - coalesce(order_row.discount_total, 0), 2) then
    raise exception 'Bulk line values and GST do not match the captured order total; billing review is required';
  end if;

  fy_start := case when extract(month from now() at time zone 'Asia/Kolkata') >= 4 then extract(year from now() at time zone 'Asia/Kolkata')::integer else extract(year from now() at time zone 'Asia/Kolkata')::integer - 1 end;
  v_financial_year := right(fy_start::text, 2) || '-' || right((fy_start + 1)::text, 2);
  insert into public.seller_invoice_sequences (seller_id, financial_year, last_number)
  values (seller_row.id, v_financial_year, 1)
  on conflict (seller_id, financial_year)
  do update set last_number = public.seller_invoice_sequences.last_number + 1, updated_at = now()
  returning last_number into sequence_number;
  generated_invoice_number := 'FT/' || v_financial_year || '/' || lpad(sequence_number::text, 6, '0');

  supplier_payload := jsonb_build_object(
    'legalName', seller_row.legal_business_name,
    'tradeName', coalesce(seller_row.display_name, seller_row.legal_business_name),
    'gstin', seller_row.gstin,
    'address', coalesce(seller_row.pickup_address, '{}'::jsonb),
    'email', seller_user_row.email,
    'phone', seller_user_row.phone
  );
  recipient_payload := jsonb_build_object(
    'name', coalesce(order_row.buyer_name, buyer_row.full_name),
    'businessName', coalesce(order_row.buyer_company, buyer_row.business_name),
    'gstin', order_row.buyer_gstin,
    'email', coalesce(order_row.buyer_email, buyer_row.email),
    'phone', buyer_row.phone,
    'addressLine1', buyer_row.address_line1,
    'addressLine2', buyer_row.address_line2,
    'city', buyer_row.city,
    'state', buyer_row.state,
    'pincode', buyer_row.pincode
  );
  delivery_payload := jsonb_build_object(
    'addressLine1', buyer_row.address_line1,
    'addressLine2', buyer_row.address_line2,
    'city', buyer_row.city,
    'state', buyer_row.state,
    'pincode', buyer_row.pincode
  );

  insert into public.seller_tax_invoices (
    seller_id, buyer_user_id, catalog_order_id, bulk_order_id,
    invoice_number, financial_year, issued_by_user_id, status,
    supplier, recipient, delivery_address, place_of_supply, reverse_charge, lines,
    subtotal, discount, taxable_value, cgst_amount, sgst_amount, igst_amount,
    cess_amount, total_tax, total_amount, currency, payment_reference,
    payment_captured_at, e_invoice_applicable, generation_source,
    email_status, email_recipient, document_type
  ) values (
    seller_row.id, order_row.buyer_id, null, order_row.id,
    generated_invoice_number, v_financial_year, seller_row.user_id, 'issued',
    supplier_payload, recipient_payload, delivery_payload, buyer_state, false, line_payload,
    coalesce(order_row.gross_total, greatest(order_row.net_total - order_row.gst_total, 0)),
    coalesce(order_row.discount_total, 0),
    greatest(coalesce(order_row.gross_total, order_row.net_total - order_row.gst_total) - coalesce(order_row.discount_total, 0), 0),
    computed_cgst, computed_sgst, computed_igst, 0, coalesce(order_row.gst_total, 0),
    order_row.net_total, 'INR', payment_row.razorpay_payment_id,
    coalesce(payment_row.captured_at, p_payment_captured_at, now()), false,
    'automatic_payment_capture', 'pending', coalesce(order_row.buyer_email, buyer_row.email), case when not exists(select 1 from jsonb_array_elements(line_payload) l where (l->>'gstRate')::numeric > 0) then 'bill_of_supply' else 'tax_invoice' end
  ) returning * into invoice_row;

  insert into public.commerce_notifications (
    user_id, audience, kind, title, message, action_url, entity_type, entity_id, dedupe_key, metadata
  ) values (
    order_row.buyer_id, 'buyer', 'invoice_issued', 'Invoice generated',
    'Your GST invoice ' || generated_invoice_number || ' has been generated after payment capture.',
    '/buyer-dashboard', 'seller_tax_invoice', invoice_row.id,
    'invoice-issued-' || invoice_row.id::text,
    jsonb_build_object('invoiceNumber', generated_invoice_number, 'orderId', order_row.id, 'totalAmount', order_row.net_total)
  ) on conflict (dedupe_key) do nothing;

  return invoice_row;
end;
$$;

revoke all on function public.issue_paid_catalog_tax_invoice_system(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.issue_paid_bulk_tax_invoice_system(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.issue_paid_catalog_tax_invoice_system(uuid,text,timestamptz) to service_role;
grant execute on function public.issue_paid_bulk_tax_invoice_system(uuid,text,timestamptz) to service_role;

-- A receipt is issued for every verified capture. A final invoice is a separate,
-- whole-order document; advances and balances never become duplicate final invoices.
create or replace function public.issue_bespoke_payment_documents_system(
  p_bespoke_order_id uuid, p_payment_reference text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  o public.bespoke_orders%rowtype; p public.bespoke_payments%rowtype;
  s public.seller_profiles%rowtype; su public.user_profiles%rowtype; b public.user_profiles%rowtype;
  receipt public.seller_tax_invoices%rowtype; final_invoice public.seller_tax_invoices%rowtype;
  first_receipt public.seller_tax_invoices%rowtype;
  details jsonb; valid_details boolean; supplier jsonb; recipient jsonb; delivery jsonb;
  buyer_state text; seller_state text; intra boolean; quote numeric; captured numeric; refunded numeric;
  taxable numeric; tax numeric; cgst numeric; sgst numeric; igst numeric; rate numeric;
  fy text; fy_start integer; seq integer; number text; invoice_lines jsonb;
  documents jsonb := '[]'::jsonb; billing_error text; purpose text; tax_on_advance boolean;
  references_json jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select * into o from public.bespoke_orders where id=p_bespoke_order_id for update;
  if not found then raise exception 'Custom order not found'; end if;
  select * into p from public.bespoke_payments where bespoke_order_id=o.id
    and razorpay_payment_id=p_payment_reference and user_id=o.user_id and currency='INR'
    and status in ('captured','partially_refunded','refunded');
  if not found or p.captured_at is null then raise exception 'Captured custom-order payment evidence is missing'; end if;
  select * into s from public.seller_profiles where id=o.seller_id for update;
  if not found then raise exception 'Custom-order seller is missing'; end if;
  select * into su from public.user_profiles where id=s.user_id;
  select * into b from public.user_profiles where id=o.user_id;
  if not found then raise exception 'Buyer profile is unavailable'; end if;
  details := coalesce(p.invoice_quote->'invoice', o.quotation->'invoice');
  valid_details := public.valid_bespoke_invoice_details(details);
  quote := coalesce((p.invoice_quote->>'quotedAmount')::numeric, o.quoted_amount, 0);
  select coalesce(sum(amount),0), coalesce(sum(refunded_amount),0), jsonb_agg(razorpay_payment_id order by captured_at,id)
    into captured,refunded,references_json from public.bespoke_payments
    where bespoke_order_id=o.id and currency='INR' and status in ('captured','partially_refunded','refunded');
  select * into first_receipt from public.seller_tax_invoices where bespoke_order_id=o.id
    order by issued_at,id limit 1;
  supplier := coalesce(first_receipt.supplier, jsonb_build_object(
    'legalName',s.legal_business_name,'tradeName',coalesce(s.display_name,s.legal_business_name),
    'gstin',s.gstin,'address',s.pickup_address,'email',su.email,'phone',su.phone));
  recipient := coalesce(first_receipt.recipient,jsonb_build_object(
    'name',b.full_name,'businessName',b.business_name,'gstin',b.gstin,'email',b.email,'phone',b.phone,
    'addressLine1',b.address_line1,'addressLine2',b.address_line2,'city',b.city,'state',b.state,'pincode',b.pincode));
  delivery := coalesce(first_receipt.delivery_address, recipient);
  buyer_state := coalesce(first_receipt.place_of_supply,b.state);
  seller_state := coalesce(supplier->'address'->>'state',su.state);
  intra := lower(trim(buyer_state))=lower(trim(seller_state));
  rate := case when valid_details then (details->>'gstRate')::numeric else 0 end;
  fy_start := case when extract(month from now() at time zone 'Asia/Kolkata')>=4
    then extract(year from now() at time zone 'Asia/Kolkata')::integer else extract(year from now() at time zone 'Asia/Kolkata')::integer-1 end;
  fy := right(fy_start::text,2)||'-'||right((fy_start+1)::text,2);
  purpose := p.payment_purpose;
  tax_on_advance := valid_details and details->>'supplyType'='services' and purpose='advance'
    and nullif(trim(buyer_state),'') is not null and nullif(trim(seller_state),'') is not null;
  select * into receipt from public.seller_tax_invoices where bespoke_payment_id=p.id;
  if not found then
    taxable := case when tax_on_advance then round(p.amount/(1+rate/100),2) else 0 end;
    tax := case when tax_on_advance then p.amount-taxable else 0 end;
    cgst := case when intra then round(tax/2,2) else 0 end;
    sgst := case when intra then tax-cgst else 0 end;
    igst := tax-cgst-sgst;
    insert into public.seller_invoice_sequences(seller_id,financial_year,last_number) values(s.id,fy,1)
      on conflict(seller_id,financial_year) do update set last_number=public.seller_invoice_sequences.last_number+1,updated_at=now()
      returning last_number into seq;
    number := 'FR/'||fy||'/'||lpad(seq::text,6,'0');
    insert into public.seller_tax_invoices(seller_id,buyer_user_id,bespoke_order_id,bespoke_payment_id,
      invoice_number,financial_year,issued_by_user_id,document_type,supplier,recipient,delivery_address,place_of_supply,
      lines,subtotal,discount,taxable_value,cgst_amount,sgst_amount,igst_amount,cess_amount,total_tax,total_amount,
      currency,payment_reference,payment_captured_at,generation_source,email_recipient,document_metadata)
    values(s.id,o.user_id,o.id,p.id,number,fy,s.user_id,'payment_receipt',supplier,recipient,delivery,buyer_state,
      jsonb_build_array(jsonb_build_object('description',initcap(purpose)||' payment — '||coalesce(details->>'description','Custom order'),
        'hsnCode',details->>'hsnCode','quantity',1,'unit','payment','unitPrice',p.amount,
        'taxableValue',taxable,'gstRate',case when tax_on_advance then rate else 0 end,
        'cgstAmount',cgst,'sgstAmount',sgst,'igstAmount',igst,'cessAmount',0,'lineTotal',p.amount)),
      case when tax_on_advance then taxable else p.amount end,0,taxable,cgst,sgst,igst,0,tax,p.amount,
      'INR',p.razorpay_payment_id,p.captured_at,'automatic_payment_capture',b.email,
      jsonb_build_object('paymentPurpose',purpose,'quotedAmount',quote,'capturedToDate',captured,
        'balanceAtIssue',greatest(quote-captured+refunded,0),'supplyType',details->>'supplyType',
        'taxOnAdvance',tax_on_advance,'paymentReferences',jsonb_build_array(p.razorpay_payment_id)))
    returning * into receipt;
  end if;
  documents := documents||jsonb_build_array(to_jsonb(receipt));
  select * into final_invoice from public.seller_tax_invoices where bespoke_order_id=o.id and document_type<>'payment_receipt';
  if found then
    documents := documents||jsonb_build_array(to_jsonb(final_invoice));
  elsif quote>0 and captured-refunded>=quote then
    if not valid_details then billing_error := 'Complete the quotation HSN/SAC, description, supply type and GST rate to issue the final invoice.';
    elsif nullif(trim(buyer_state),'') is null or nullif(trim(seller_state),'') is null then billing_error := 'Supplier and buyer states are required for GST.';
    elsif s.gstin_verified is distinct from true then billing_error := 'Seller GST verification is required for a final invoice.';
    elsif s.e_invoice_applicable is true and nullif(trim(recipient->>'gstin'),'') is not null and rate>0 then billing_error := 'E_INVOICE_IRN_REQUIRED: the seller must provide the registered e-invoice.';
    else
      taxable := round(quote/(1+rate/100),2); tax := quote-taxable;
      cgst := case when intra then round(tax/2,2) else 0 end;
      sgst := case when intra then tax-cgst else 0 end; igst := tax-cgst-sgst;
      invoice_lines := jsonb_build_array(jsonb_build_object('description',details->>'description','hsnCode',details->>'hsnCode',
        'quantity',1,'unit','order','unitPrice',taxable,'taxableValue',taxable,'gstRate',rate,
        'cgstAmount',cgst,'sgstAmount',sgst,'igstAmount',igst,'cessAmount',0,'lineTotal',quote));
      insert into public.seller_invoice_sequences(seller_id,financial_year,last_number) values(s.id,fy,1)
        on conflict(seller_id,financial_year) do update set last_number=public.seller_invoice_sequences.last_number+1,updated_at=now()
        returning last_number into seq;
      number := 'FT/'||fy||'/'||lpad(seq::text,6,'0');
      insert into public.seller_tax_invoices(seller_id,buyer_user_id,bespoke_order_id,invoice_number,financial_year,
        issued_by_user_id,document_type,supplier,recipient,delivery_address,place_of_supply,
        lines,subtotal,discount,taxable_value,cgst_amount,sgst_amount,igst_amount,cess_amount,total_tax,total_amount,
        currency,payment_reference,payment_captured_at,generation_source,email_recipient,document_metadata)
      values(s.id,o.user_id,o.id,number,fy,s.user_id,case when rate=0 then 'bill_of_supply' else 'tax_invoice' end,
        supplier,recipient,delivery,buyer_state,invoice_lines,taxable,0,taxable,cgst,sgst,igst,0,tax,quote,
        'INR',p.razorpay_payment_id,p.captured_at,'automatic_payment_capture',b.email,
        jsonb_build_object('paymentPurpose','final','quotedAmount',quote,'capturedToDate',captured,
          'balanceAtIssue',0,'supplyType',details->>'supplyType','paymentReferences',references_json))
      returning * into final_invoice;
      documents := documents||jsonb_build_array(to_jsonb(final_invoice));
    end if;
  end if;
  insert into public.commerce_notifications(user_id,audience,kind,title,message,action_url,entity_type,entity_id,dedupe_key,metadata)
    values(o.user_id,'buyer','invoice_issued','Payment receipt available','Your custom-order payment receipt is ready.',
      '/custom-order?order='||o.id,'seller_tax_invoice',receipt.id,'invoice-issued-'||receipt.id,
      jsonb_build_object('invoiceNumber',receipt.invoice_number,'orderId',o.id,'totalAmount',p.amount))
    on conflict(dedupe_key) do nothing;
  return jsonb_build_object('documents',documents,'invoiceError',billing_error);
end;
$$;
revoke all on function public.issue_bespoke_payment_documents_system(uuid,text) from public,anon,authenticated;
grant execute on function public.issue_bespoke_payment_documents_system(uuid,text) to service_role;

create or replace function public.protect_issued_invoice_snapshot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (to_jsonb(new)-array['status','email_status','email_recipient','email_provider_id','email_attempted_at','email_sent_at','email_last_error','updated_at'])
    is distinct from (to_jsonb(old)-array['status','email_status','email_recipient','email_provider_id','email_attempted_at','email_sent_at','email_last_error','updated_at']) then
    raise exception 'Issued invoice values are immutable; use a separate correction document';
  end if;
  if old.status='void' and new.status<>'void' then raise exception 'A void document cannot be reissued'; end if;
  return new;
end;
$$;
revoke all on function public.protect_issued_invoice_snapshot() from public,anon,authenticated;
create trigger seller_tax_invoices_immutable_snapshot before update on public.seller_tax_invoices
  for each row execute function public.protect_issued_invoice_snapshot();
