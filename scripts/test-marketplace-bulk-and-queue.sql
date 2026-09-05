begin;
do $audit$
declare buyer uuid; seller uuid; seller_user uuid; o uuid; job_a text := 'audit-'||gen_random_uuid(); job_b text := 'audit-'||gen_random_uuid(); r jsonb; n integer;
begin
  select bp.user_id into buyer from public.buyer_profiles bp join public.user_profiles u on u.id=bp.user_id where bp.is_active and u.is_active and u.can_buy and u.role='buyer' limit 1;
  select s.id,s.user_id into seller,seller_user from public.seller_profiles s join public.user_profiles u on u.id=s.user_id where s.is_active and u.is_active and u.can_sell limit 1;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into public.bulk_orders(buyer_id,seller_id,status,net_total,gross_total,payment_status,amount_paid)
    values(buyer,seller,'paid',100,100,'paid',100) returning id into o;
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',seller_user)::text,true);
  execute 'set local role authenticated';
  if not exists(select 1 from public.bulk_orders where id=o) then raise exception 'Seller cannot read own bulk order'; end if;
  perform public.save_my_manual_shipment(o,'bulk','Independent courier','AUDIT-BULK','https://tracking.example.com/bulk',null,'in_transit');
  if (select status from public.bulk_orders where id=o)<>'shipped' then raise exception 'Bulk shipment did not mark shipped'; end if;
  perform public.save_my_manual_shipment(o,'bulk','Independent courier','AUDIT-BULK','https://tracking.example.com/bulk',null,'delivered');
  if (select status from public.bulk_orders where id=o)<>'delivered' then raise exception 'Bulk delivery did not complete order'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',buyer)::text,true);
  execute 'set local role authenticated';
  if not exists(select 1 from public.seller_shipments where bulk_order_id=o) then raise exception 'Buyer cannot read tracking'; end if;
  delete from public.bulk_orders where id=o;
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Buyer deleted a paid order'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into public.seller_whatsapp_jobs(message_id,sender,payload,created_at)
    values(job_a,'audit-sender','{}',now()-interval '1 second'),(job_b,'audit-sender','{}',now());
  if public.claim_seller_whatsapp_job(job_b) is not null then raise exception 'Queue processed seller messages out of order'; end if;
  r:=public.claim_seller_whatsapp_job(job_a);
  if r->>'status'<>'processing' or (r->>'attempts')::int<>1 then raise exception 'Queue did not reserve message'; end if;
  if public.claim_seller_whatsapp_job(job_a) is not null then raise exception 'Queue duplicated active lease'; end if;
  if public.claim_seller_whatsapp_job(job_b) is not null then raise exception 'Queue raced same seller'; end if;
  update public.seller_whatsapp_jobs set status='completed',locked_until=null where message_id=job_a;
  if public.claim_seller_whatsapp_job(job_b) is null then raise exception 'Queue did not release next seller message'; end if;
end;
$audit$;
rollback;
