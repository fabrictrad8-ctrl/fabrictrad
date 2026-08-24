-- Automatic billing: final tax invoices are created only after server-side
-- confirmation of a captured, fully-paid Razorpay order. Manual billing remains
-- available separately for corrections and dispatch documents.

alter table public.seller_tax_invoices
  alter column catalog_order_id drop not null;

alter table public.seller_tax_invoices
  add column if not exists bulk_order_id uuid references public.bulk_orders(id) on delete restrict,
  add column if not exists generation_source text not null default 'manual',
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_recipient text,
  add column if not exists email_provider_id text,
  add column if not exists email_attempted_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_last_error text;

alter table public.seller_tax_invoices
  drop constraint if exists seller_tax_invoices_order_source_check,
  add constraint seller_tax_invoices_order_source_check
    check (num_nonnulls(catalog_order_id, bulk_order_id) = 1),
  drop constraint if exists seller_tax_invoices_generation_source_check,
  add constraint seller_tax_invoices_generation_source_check
    check (generation_source in ('manual', 'automatic_payment_capture')),
  drop constraint if exists seller_tax_invoices_email_status_check,
  add constraint seller_tax_invoices_email_status_check
    check (email_status in ('pending', 'sending', 'sent', 'failed', 'not_configured'));

create unique index if not exists seller_tax_invoices_bulk_order_id_key
  on public.seller_tax_invoices (bulk_order_id)
  where bulk_order_id is not null;
create index if not exists seller_tax_invoices_email_status_idx
  on public.seller_tax_invoices (email_status, issued_at desc);

create or replace function public.issue_paid_catalog_tax_invoice_system(
  p_catalog_order_id uuid,
  p_payment_reference text,
  p_payment_captured_at timestamptz default now()
)
returns public.seller_tax_invoices
language plpgsql
security definer
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
  financial_year text;
  generated_invoice_number text;
  supplier_payload jsonb;
  recipient_payload jsonb;
  delivery_payload jsonb;
  line_payload jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role is required for automatic invoice generation' using errcode = '42501';
  end if;

  select * into existing_invoice from public.seller_tax_invoices where catalog_order_id = p_catalog_order_id;
  if found then return existing_invoice; end if;

  select * into order_row from public.catalog_order_requests where id = p_catalog_order_id for update;
  if not found then raise exception 'Catalogue order not found'; end if;
  if order_row.payment_status <> 'paid' or order_row.status not in ('paid', 'fulfilled') then
    raise exception 'The catalogue order must be fully paid before automatic invoice generation';
  end if;

  select * into payment_row
  from public.catalog_order_payments
  where catalog_order_id = order_row.id
    and status in ('captured','partially_refunded','refunded')
    and razorpay_payment_id is not null
  order by captured_at desc nulls last, created_at desc
  limit 1;
  if not found then raise exception 'Captured Razorpay payment evidence is missing'; end if;

  select * into seller_row from public.seller_profiles where id = order_row.seller_id for update;
  if not found
     or seller_row.is_active is distinct from true
     or seller_row.gstin_verified is distinct from true
     or seller_row.verification_status::text not in ('approved','verified','active') then
    raise exception 'An active GST-verified seller is required before issuing an invoice';
  end if;
  if seller_row.e_invoice_applicable is true then
    raise exception 'E_INVOICE_IRN_REQUIRED: automatic GST invoice is waiting for IRN and signed QR data';
  end if;

  select * into seller_user_row from public.user_profiles where id = seller_row.user_id;
  if not found then raise exception 'Seller account profile is unavailable'; end if;
  select * into buyer_row from public.user_profiles where id = order_row.buyer_id;
  if not found then raise exception 'Buyer account profile is unavailable'; end if;
  select * into product_row from public.seller_products where id = order_row.product_id;
  if not found then raise exception 'Product snapshot source is unavailable'; end if;
  if nullif(trim(coalesce(product_row.hsn_code, '')), '') is null then
    raise exception 'HSN_REQUIRED: add a valid HSN code to the product before issuing its GST invoice';
  end if;

  fy_start := case when extract(month from now()) >= 4 then extract(year from now())::integer else extract(year from now())::integer - 1 end;
  financial_year := right(fy_start::text, 2) || '-' || right((fy_start + 1)::text, 2);
  insert into public.seller_invoice_sequences (seller_id, financial_year, last_number)
  values (seller_row.id, financial_year, 1)
  on conflict (seller_id, financial_year)
  do update set last_number = public.seller_invoice_sequences.last_number + 1, updated_at = now()
  returning last_number into sequence_number;
  generated_invoice_number := 'FT/' || financial_year || '/' || lpad(sequence_number::text, 6, '0');

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
    'hsnCode', product_row.hsn_code,
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
    email_status, email_recipient
  ) values (
    seller_row.id, order_row.buyer_id, order_row.id, null,
    generated_invoice_number, financial_year, seller_row.user_id, 'issued',
    supplier_payload, recipient_payload, delivery_payload,
    coalesce(order_row.place_of_supply_state, buyer_row.state), false, line_payload,
    order_row.subtotal, 0, order_row.subtotal, order_row.cgst_amount,
    order_row.sgst_amount, order_row.igst_amount, 0, order_row.gst_amount,
    order_row.total_amount, 'INR', coalesce(nullif(trim(p_payment_reference), ''), payment_row.razorpay_payment_id),
    coalesce(p_payment_captured_at, payment_row.captured_at, now()), false,
    'automatic_payment_capture', 'pending', buyer_row.email
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
security definer
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
  financial_year text;
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

  select * into existing_invoice from public.seller_tax_invoices where bulk_order_id = p_bulk_order_id;
  if found then return existing_invoice; end if;

  select * into order_row from public.bulk_orders where id = p_bulk_order_id for update;
  if not found then raise exception 'Bulk order not found'; end if;
  if order_row.payment_status <> 'paid' or order_row.status not in ('paid','shipped','delivered') then
    raise exception 'The bulk order must be fully paid before automatic invoice generation';
  end if;

  select * into payment_row
  from public.bulk_order_payments
  where bulk_order_id = order_row.id
    and status in ('captured','partially_refunded','refunded')
    and razorpay_payment_id is not null
  order by captured_at desc nulls last, created_at desc
  limit 1;
  if not found then raise exception 'Captured Razorpay payment evidence is missing'; end if;

  select * into seller_row from public.seller_profiles where id = order_row.seller_id for update;
  if not found
     or seller_row.is_active is distinct from true
     or seller_row.gstin_verified is distinct from true
     or seller_row.verification_status::text not in ('approved','verified','active') then
    raise exception 'An active GST-verified seller is required before issuing an invoice';
  end if;
  if seller_row.e_invoice_applicable is true then
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
      and nullif(trim(coalesce(p.hsn_code, '')), '') is null
  ) into missing_hsn;
  if missing_hsn then
    raise exception 'HSN_REQUIRED: every bulk-order item must map to a seller product with a valid HSN code';
  end if;

  select jsonb_agg(jsonb_build_object(
      'description', i.product_name,
      'sku', i.sku,
      'hsnCode', p.hsn_code,
      'quantity', i.quantity_mtrs,
      'unit', 'mtr',
      'unitPrice', i.price_per_mtr,
      'discountPct', i.discount_pct,
      'gstRate', i.gst_rate,
      'lineTotal', i.line_total
    ) order by i.created_at)
  into line_payload
  from public.bulk_order_items i
  join public.seller_products p on p.seller_id = seller_row.id and p.sku = i.sku
  where i.bulk_order_id = order_row.id;
  if line_payload is null or jsonb_array_length(line_payload) = 0 then
    raise exception 'Bulk order has no invoiceable line items';
  end if;

  buyer_state := buyer_row.state;
  seller_state := coalesce(seller_row.pickup_address->>'state', seller_user_row.state);
  intra_state := buyer_state is not null and seller_state is not null and lower(trim(buyer_state)) = lower(trim(seller_state));
  if intra_state then
    computed_cgst := round(coalesce(order_row.gst_total, 0) / 2, 2);
    computed_sgst := coalesce(order_row.gst_total, 0) - computed_cgst;
  else
    computed_igst := coalesce(order_row.gst_total, 0);
  end if;

  fy_start := case when extract(month from now()) >= 4 then extract(year from now())::integer else extract(year from now())::integer - 1 end;
  financial_year := right(fy_start::text, 2) || '-' || right((fy_start + 1)::text, 2);
  insert into public.seller_invoice_sequences (seller_id, financial_year, last_number)
  values (seller_row.id, financial_year, 1)
  on conflict (seller_id, financial_year)
  do update set last_number = public.seller_invoice_sequences.last_number + 1, updated_at = now()
  returning last_number into sequence_number;
  generated_invoice_number := 'FT/' || financial_year || '/' || lpad(sequence_number::text, 6, '0');

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
    email_status, email_recipient
  ) values (
    seller_row.id, order_row.buyer_id, null, order_row.id,
    generated_invoice_number, financial_year, seller_row.user_id, 'issued',
    supplier_payload, recipient_payload, delivery_payload, buyer_state, false, line_payload,
    coalesce(order_row.gross_total, greatest(order_row.net_total - order_row.gst_total, 0)),
    coalesce(order_row.discount_total, 0),
    greatest(coalesce(order_row.gross_total, order_row.net_total - order_row.gst_total) - coalesce(order_row.discount_total, 0), 0),
    computed_cgst, computed_sgst, computed_igst, 0, coalesce(order_row.gst_total, 0),
    order_row.net_total, 'INR', coalesce(nullif(trim(p_payment_reference), ''), payment_row.razorpay_payment_id),
    coalesce(p_payment_captured_at, payment_row.captured_at, now()), false,
    'automatic_payment_capture', 'pending', coalesce(order_row.buyer_email, buyer_row.email)
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
