begin;
do $audit$
declare
  buyer uuid; seller uuid; seller_user uuid; product_a uuid; product_b uuid; a uuid; b uuid;
  payment_a uuid; payment_b uuid; total_a numeric; total_b numeric; snapshot numeric; result jsonb; n integer;
begin
  select bp.user_id into buyer from public.buyer_profiles bp join public.user_profiles u on u.id=bp.user_id
    where bp.is_active and u.is_active and u.can_buy and u.role='buyer' limit 1;
  select s.id,s.user_id into seller,seller_user from public.seller_profiles s join public.user_profiles u on u.id=s.user_id
    where s.is_active and u.is_active and u.can_sell limit 1;
  if buyer is null or seller is null then raise exception 'Audit needs existing active buyer and seller identities'; end if;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into public.seller_products(seller_id,name,sku,price_per_unit,unit,available_quantity,moq,sale_channel,
    end_user_enabled,end_user_limit_mode,end_user_min_quantity,retail_store_min_quantity,status,approval_status,hsn_code,gst_rate)
  values(seller,'Rollback audit textile A','AUDIT-'||gen_random_uuid(),100,'piece',100,1,'both',true,'custom',1,1,'active','approved','5208',5)
  returning id into product_a;
  insert into public.seller_products(seller_id,name,sku,price_per_unit,unit,available_quantity,moq,sale_channel,
    end_user_enabled,end_user_limit_mode,end_user_min_quantity,retail_store_min_quantity,status,approval_status,hsn_code,gst_rate)
  values(seller,'Rollback audit textile B','AUDIT-'||gen_random_uuid(),100,'piece',100,1,'both',true,'custom',1,1,'active','approved','5208',5)
  returning id into product_b;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',buyer)::text,true);
  execute 'set local role authenticated';
  result:=public.submit_catalog_order_request(product_a,null,1);
  a:=(result->>'id')::uuid;
  result:=public.submit_catalog_order_request(product_b,null,1);
  b:=(result->>'id')::uuid;
  if (public.submit_catalog_order_request(product_a,null,1)->>'id')::uuid<>a then raise exception 'Order retry did not reuse order'; end if;
  select available_quantity into snapshot from public.seller_products where id=product_b;
  update public.catalog_order_requests set status='cancelled' where id=b;
  if (select available_quantity from public.seller_products where id=product_b)<>snapshot+1 then raise exception 'Cancellation restored incorrect stock'; end if;
  update public.catalog_order_requests set status='cancelled' where id=b;
  if (select available_quantity from public.seller_products where id=product_b)<>snapshot+1 then raise exception 'Cancellation retry changed stock'; end if;
  b:=(public.submit_catalog_order_request(product_b,null,1)->>'id')::uuid;
  begin
    perform public.save_my_manual_shipment(a,'catalog','Courier A','AUDIT-A','https://tracking.example.com/A',null,'in_transit');
    raise exception 'Buyer shipment write unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'SELLER_ACCESS_REQUIRED' then raise; end if;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  select total_amount into total_a from public.catalog_order_requests where id=a;
  select total_amount into total_b from public.catalog_order_requests where id=b;
  insert into public.catalog_order_payments(catalog_order_id,razorpay_order_id,razorpay_payment_id,amount,status,captured_amount,captured_at)
    values(a,'audit_order_'||a,'audit_pay_'||a,total_a,'captured',total_a,now()) returning id into payment_a;
  insert into public.catalog_order_payments(catalog_order_id,razorpay_order_id,razorpay_payment_id,amount,status,captured_amount,captured_at)
    values(b,'audit_order_'||b,'audit_pay_'||b,total_b,'captured',total_b,now()) returning id into payment_b;
  -- Even a sold-out or repriced listing must not break capture of an existing order.
  update public.seller_products set available_quantity=0,price_per_unit=900 where id=product_a;
  perform public.reconcile_marketplace_payment('catalog',a);
  perform public.reconcile_marketplace_payment('catalog',b);
  if (select total_amount from public.catalog_order_requests where id=a)<>total_a then raise exception 'Capture changed invoice total'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',seller_user)::text,true);
  execute 'set local role authenticated';
  begin
    update public.catalog_order_requests set amount_paid=1 where id=a;
    raise exception 'Seller payment forgery unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'Payment and tax fields are managed by the payment service' then raise; end if;
  end;
  perform public.save_my_manual_shipment(a,'catalog','Delhivery','AUDIT-A','https://tracking.example.com/A',null,'in_transit');
  perform public.save_my_manual_shipment(b,'catalog','DTDC','AUDIT-B','https://tracking.example.com/B',null,'in_transit');
  if (select courier_name from public.seller_shipments where catalog_order_id=a)<>'Delhivery'
    or (select courier_name from public.seller_shipments where catalog_order_id=b)<>'DTDC' then raise exception 'Couriers leaked between orders'; end if;
  perform public.save_my_manual_shipment(a,'catalog','Delhivery','AUDIT-A','https://tracking.example.com/A',null,'delivered');
  if (select status from public.catalog_order_requests where id=a)<>'fulfilled' then raise exception 'Delivery did not complete order'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.reconcile_marketplace_payment('catalog',a);
  if (select status from public.catalog_order_requests where id=a)<>'fulfilled' then raise exception 'Payment retry regressed fulfillment'; end if;
  update public.catalog_order_payments set status='authorized',captured_amount=null,captured_at=null where id=payment_a;
  if (select status from public.catalog_order_payments where id=payment_a)<>'captured' then raise exception 'Late authorization regressed capture'; end if;
  perform public.record_marketplace_refund('catalog',payment_a,'audit_ref_'||a,10,'processed');
  perform public.record_marketplace_refund('catalog',payment_a,'audit_ref_'||a,10,'processed');
  perform public.record_marketplace_refund('catalog',payment_a,'audit_ref_'||a,10,'created');
  if (select refunded_amount from public.catalog_order_payments where id=payment_a)<>10 then raise exception 'Duplicate refund counted twice'; end if;
  update public.catalog_order_payments set status='captured',refunded_amount=0 where id=payment_a;
  if (select refunded_amount from public.catalog_order_payments where id=payment_a)<>10 then raise exception 'Capture retry erased refund'; end if;
  perform public.reconcile_marketplace_payment('catalog',a);
  if (select payment_status from public.catalog_order_requests where id=a)<>'partially_refunded' then raise exception 'Refund did not reconcile'; end if;
  if not exists(select 1 from public.commerce_notifications where user_id=buyer and entity_id=a and metadata->>'trackingUrl'='https://tracking.example.com/A') then raise exception 'Buyer tracking notification missing'; end if;
  perform public.admin_marketplace_totals(now()-interval '30 days');
  if (select count(*) from public.admin_marketplace_orders where id in (a,b))<>2 then raise exception 'Admin orders missing marketplace rows'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',buyer)::text,true);
  execute 'set local role authenticated';
  begin
    perform public.reconcile_marketplace_payment('catalog',a);
    raise exception 'Buyer invoked financial reconciliation';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$audit$;
rollback;
