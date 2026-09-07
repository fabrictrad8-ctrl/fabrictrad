-- Isolated local CI fixtures only. Every change is rolled back; no external calls.
begin;
do $test$
declare
  buyer uuid:=gen_random_uuid(); seller_user uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  seller uuid:=gen_random_uuid(); product uuid:=gen_random_uuid(); product2 uuid:=gen_random_uuid();
  registration uuid:=gen_random_uuid();
  catalog uuid; bulk uuid:=gen_random_uuid(); custom_order uuid:=gen_random_uuid(); free_order uuid:=gen_random_uuid();
  pay1 uuid; pay2 uuid; total numeric; result jsonb; first_id uuid; final_id uuid; n integer;
  inv public.seller_tax_invoices%rowtype;
begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into auth.users(id,email,aud,role,raw_user_meta_data) values
    (buyer,'invoice-buyer-'||buyer||'@example.test','authenticated','authenticated','{}'),
    (seller_user,'invoice-seller-'||seller_user||'@example.test','authenticated','authenticated','{"role":"seller","phone":"9000000001"}'),
    (outsider,'invoice-other-'||outsider||'@example.test','authenticated','authenticated','{}');
  select id into seller from public.seller_profiles where user_id=seller_user;
  if seller is null or exists(select 1 from public.buyer_profiles where user_id=seller_user)
    or not exists(select 1 from public.buyer_profiles where user_id=buyer and is_active)
    or exists(select 1 from public.user_profiles where id=seller_user and can_buy) then
    raise exception 'Signup did not create isolated buyer and seller workspaces';
  end if;
  update public.user_profiles set is_active=true,role='buyer',can_buy=true,can_sell=false,
    full_name='Invoice test buyer',address_line1='12 Test Road',city='Mumbai',state='Maharashtra',pincode='400001' where id=buyer;
  update public.user_profiles set is_active=true,role='seller',can_sell=true,full_name='Invoice test supplier',state='Maharashtra' where id=seller_user;
  update public.buyer_profiles set is_active=true where user_id=buyer;
  -- Local fixtures represent completed document review; no provider is contacted.
  insert into public.seller_registrations(id,user_id,seller_id,phone,registration_status,submitted_at,gstin_verified,bank_verified)
    values(registration,seller_user,'INVOICE-QA-'||seller,'9000000001','under_review',now(),true,true);
  insert into public.seller_registration_documents(registration_id,document_type,file_url,upload_status)
    select registration,kind,'https://example.test/invoice-qa/'||kind,'approved'
    from unnest(array['gst_certificate','pan_card','cancelled_cheque']) kind;
  insert into public.seller_bank_profiles(seller_id,account_holder_name,bank_name,account_number_masked,ifsc_code,is_verified)
    values(seller,'Invoice test supplier','Fixture bank','****0001','HDFC0000001',true);
  update public.seller_profiles set legal_business_name='Invoice test supplier',is_active=true,
    gstin='27AAAAA0000A1Z5',gstin_status='active',gstin_verified=true,verification_status='verified',
    pickup_address='{"addressLine1":"10 Supplier Road","city":"Mumbai","state":"Maharashtra","pincode":"400002"}'
    where id=seller;
  insert into public.seller_products(id,seller_id,name,sku,price_per_unit,unit,available_quantity,moq,sale_channel,
    end_user_enabled,end_user_limit_mode,end_user_min_quantity,retail_store_min_quantity,status,approval_status,hsn_code,gst_rate)
    values(product,seller,'Invoice textile','INVOICE-'||product,100,'piece',100,1,'both',true,'custom',1,1,'active','approved','5208',5),
    (product2,seller,'Invoice second textile','INVOICE-'||product2,200,'piece',100,1,'both',true,'custom',1,1,'active','approved','5407',18);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',buyer)::text,true);
  result:=public.submit_catalog_order_request(product,null,1);
  catalog:=(result->>'id')::uuid;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  select total_amount into total from public.catalog_order_requests where id=catalog;
  begin
    perform public.issue_paid_catalog_tax_invoice_system(catalog,'uncaptured');
    raise exception 'Unpaid invoice unexpectedly generated';
  exception when others then if sqlerrm not like '%fully paid%' then raise; end if; end;
  insert into public.catalog_order_payments(catalog_order_id,razorpay_order_id,razorpay_payment_id,amount,status,captured_amount,captured_at)
    values(catalog,'order_cat_'||catalog,'pay_cat_'||catalog,total,'captured',total,now());
  perform public.reconcile_marketplace_payment('catalog',catalog);
  begin
    perform public.issue_paid_catalog_tax_invoice_system(catalog,'wrong_payment');
    raise exception 'Unrelated payment reference unexpectedly accepted';
  exception when others then if sqlerrm not like '%evidence is missing%' then raise; end if; end;
  update public.seller_products set hsn_code='5407',price_per_unit=500 where id=product;
  update public.seller_profiles set e_invoice_applicable=true where id=seller;
  inv:=public.issue_paid_catalog_tax_invoice_system(catalog,'pay_cat_'||catalog);
  if inv.total_amount<>total or inv.lines->0->>'hsnCode'<>'5208' then raise exception 'Catalogue invoice did not preserve order tax snapshot'; end if;
  first_id:=inv.id;
  inv:=public.issue_paid_catalog_tax_invoice_system(catalog,'pay_cat_'||catalog);
  if inv.id<>first_id then raise exception 'Catalogue retry duplicated invoice'; end if;
  begin update public.seller_tax_invoices set total_amount=1 where id=first_id;
    raise exception 'Issued invoice was mutable';
  exception when others then if sqlerrm not like '%immutable%' then raise; end if; end;

  insert into public.bulk_orders(id,buyer_id,seller_id,status,payment_status,buyer_name,buyer_email,buyer_gstin,gross_total,discount_total,gst_total,net_total)
    values(bulk,buyer,seller,'confirmed','unpaid','Invoice test buyer','invoice@example.test','27BBBBB0000B1Z5',900,60,112.20,952.20);
  insert into public.bulk_order_items(bulk_order_id,product_name,sku,price_per_mtr,quantity_mtrs,moq_tier,discount_pct,gst_rate,line_total)
    values(bulk,'Invoice textile','INVOICE-'||product,100,3,3,0,5,315),
    (bulk,'Invoice second textile','INVOICE-'||product2,200,3,3,10,18,637.20);
  insert into public.bulk_order_payments(bulk_order_id,razorpay_order_id,razorpay_payment_id,amount,status,captured_amount,captured_at)
    values(bulk,'order_bulk_'||bulk,'pay_bulk_'||bulk,952.20,'captured',952.20,now());
  perform public.reconcile_marketplace_payment('bulk',bulk);
  begin
    perform public.issue_paid_bulk_tax_invoice_system(bulk,'pay_bulk_'||bulk);
    raise exception 'B2B e-invoice did not require IRN';
  exception when others then if sqlerrm not like 'E_INVOICE_IRN_REQUIRED%' then raise; end if; end;
  update public.seller_profiles set e_invoice_applicable=false where id=seller;
  inv:=public.issue_paid_bulk_tax_invoice_system(bulk,'pay_bulk_'||bulk);
  if inv.total_amount<>952.20 or inv.taxable_value<>840 or inv.cgst_amount<>56.10 or inv.sgst_amount<>56.10
    or (select sum((l->>'taxableValue')::numeric) from jsonb_array_elements(inv.lines) l)<>840 then raise exception 'Bulk discount or per-line GST calculation failed: %',to_jsonb(inv); end if;
  first_id:=inv.id;
  inv:=public.issue_paid_bulk_tax_invoice_system(bulk,'pay_bulk_'||bulk);
  if inv.id<>first_id then raise exception 'Bulk retry duplicated invoice'; end if;

  insert into public.bespoke_orders(id,user_id,seller_id,stage,quoted_amount,advance_amount,quotation)
    values(custom_order,buyer,seller,'advance_or_full_payment',1180,590,
      '{"invoice":{"description":"Tailoring services","hsnCode":"998822","gstRate":18,"supplyType":"services"}}'),
    (free_order,buyer,seller,'advance_or_full_payment',500,0,'{}');
  begin
    insert into public.bespoke_payments(bespoke_order_id,user_id,razorpay_order_id,payment_purpose,amount)
      values(free_order,buyer,'missing_quote','full',500);
    raise exception 'Checkout accepted missing tax classification';
  exception when others then if sqlerrm not like '%Complete the quotation%' then raise; end if; end;
  insert into public.bespoke_payments(bespoke_order_id,user_id,razorpay_order_id,razorpay_payment_id,payment_purpose,amount,status,captured_at)
    values(custom_order,buyer,'order_adv_'||custom_order,'pay_adv_'||custom_order,'advance',590,'captured',now()) returning id into pay1;
  result:=public.issue_bespoke_payment_documents_system(custom_order,'pay_adv_'||custom_order);
  if jsonb_array_length(result->'documents')<>1 or result->'documents'->0->>'document_type'<>'payment_receipt'
    or (result->'documents'->0->>'total_amount')::numeric<>590 or (result->'documents'->0->>'total_tax')::numeric<>90
    or (result->'documents'->0->'document_metadata'->>'balanceAtIssue')::numeric<>590 then raise exception 'Advance receipt incorrect: %',result; end if;
  first_id:=(result->'documents'->0->>'id')::uuid;
  update public.bespoke_payments set captured_at=now()+interval '1 day' where id=pay1;
  if (select captured_at from public.bespoke_payments where id=pay1)<>now() then raise exception 'Capture replay changed the receipt date'; end if;
  begin update public.bespoke_payments set invoice_quote='{}' where id=pay1;
    raise exception 'Payment quote was mutable';
  exception when others then if sqlerrm not like '%immutable%' then raise; end if; end;
  result:=public.issue_bespoke_payment_documents_system(custom_order,'pay_adv_'||custom_order);
  if (result->'documents'->0->>'id')::uuid<>first_id then raise exception 'Advance receipt duplicated'; end if;
  begin update public.bespoke_orders set quoted_amount=1300 where id=custom_order;
    raise exception 'Paid quotation changed';
  exception when others then if sqlerrm not like '%locked after checkout%' then raise; end if; end;
  insert into public.bespoke_payments(bespoke_order_id,user_id,razorpay_order_id,razorpay_payment_id,payment_purpose,amount,status,captured_at)
    values(custom_order,buyer,'order_bal_'||custom_order,'pay_bal_'||custom_order,'balance',590,'captured',now()) returning id into pay2;
  result:=public.issue_bespoke_payment_documents_system(custom_order,'pay_bal_'||custom_order);
  if jsonb_array_length(result->'documents')<>2 or result->>'invoiceError' is not null then raise exception 'Final invoice was not generated: %',result; end if;
  select * into inv from public.seller_tax_invoices where bespoke_order_id=custom_order and document_type='tax_invoice';
  final_id:=inv.id;
  if inv.total_amount<>1180 or inv.taxable_value<>1000 or inv.total_tax<>180
    or jsonb_array_length(inv.document_metadata->'paymentReferences')<>2 then raise exception 'Final custom invoice is not the full quotation'; end if;
  perform public.issue_bespoke_payment_documents_system(custom_order,'pay_bal_'||custom_order);
  if (select count(*) from public.seller_tax_invoices where bespoke_order_id=custom_order)<>3 then raise exception 'Balance retry duplicated billing documents'; end if;
  update public.bespoke_payments set status='refunded',refunded_amount=590 where id=pay1;
  update public.bespoke_payments set status='captured',refunded_amount=0 where id=pay1;
  if not exists(select 1 from public.bespoke_payments where id=pay1 and status='refunded' and refunded_amount=590) then
    raise exception 'Capture replay erased an accounted refund';
  end if;
  perform public.issue_bespoke_payment_documents_system(custom_order,'pay_bal_'||custom_order);
  if (select total_amount from public.seller_tax_invoices where id=final_id)<>1180 then raise exception 'Refund rewrote the final invoice'; end if;

  -- A full, nil-rated goods payment has a separate bill of supply and receipt.
  update public.user_profiles set state='Gujarat' where id=buyer;
  update public.bespoke_orders set quotation='{"invoice":{"description":"Nil-rated goods","hsnCode":"5208","gstRate":0,"supplyType":"goods"}}' where id=free_order;
  insert into public.bespoke_payments(bespoke_order_id,user_id,razorpay_order_id,razorpay_payment_id,payment_purpose,amount,status,captured_at)
    values(free_order,buyer,'order_full_'||free_order,'pay_full_'||free_order,'full',500,'captured',now());
  result:=public.issue_bespoke_payment_documents_system(free_order,'pay_full_'||free_order);
  if not exists(select 1 from public.seller_tax_invoices where bespoke_order_id=free_order and document_type='bill_of_supply' and total_amount=500 and total_tax=0) then raise exception 'Full nil-rated goods document missing'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',outsider)::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.seller_tax_invoices where seller_id=seller;
  if n<>0 then raise exception 'Unrelated buyer can read billing documents'; end if;
  begin perform public.issue_bespoke_payment_documents_system(custom_order,'pay_bal_'||custom_order);
    raise exception 'Client invoked service billing RPC'; exception when insufficient_privilege then null; end;
  begin update public.seller_tax_invoices set status='void' where id=final_id;
    raise exception 'Client modified an invoice'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',buyer)::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.seller_tax_invoices where seller_id=seller)<>7 then raise exception 'Buyer is missing order documents'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',seller_user)::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.seller_tax_invoices where seller_id=seller)<>7 then raise exception 'Seller is missing order documents'; end if;
  execute 'reset role';
end;
$test$;
rollback;
