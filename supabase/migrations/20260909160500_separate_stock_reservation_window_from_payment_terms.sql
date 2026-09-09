-- payment_due_at is a BILLING term, not a stock-reservation window.
-- submit_catalog_order_request sets it to created_at + 2 days even for
-- 'due_on_order', so keying reservation expiry on it stranded a seller's stock
-- for two days on every abandoned instant checkout — and contradicted the
-- buyer-facing copy, which promises release after 30 minutes.
--
-- Immediate-payment checkouts now release after 30 minutes. Agreed credit
-- terms (net_7/net_30/net_90) still hold their reservation until genuinely due,
-- because the seller has accepted that payment lands later.
create or replace function public.expire_direct_catalog_orders()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  affected integer := 0;
  prev_claims text := current_setting('request.jwt.claims', true);
begin
  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);

  update public.catalog_order_requests
     set status = 'cancelled',
         notes = concat_ws(E'\n', nullif(notes,''), 'Automatic cancellation: unpaid checkout reservation expired.'),
         updated_at = now()
   where status = 'accepted'
     and payment_status in ('unpaid','failed')
     and coalesce(amount_paid,0) <= 0
     and (
       case
         when coalesce(payment_terms, 'due_on_order') = 'due_on_order'
           then created_at < now() - interval '30 minutes'
         when payment_due_at is not null
           then payment_due_at < now()
         else created_at < now() - interval '30 minutes'
       end
     );
  get diagnostics affected = row_count;

  perform set_config('request.jwt.claims', coalesce(prev_claims, ''), true);
  return affected;
end;
$function$;

revoke execute on function public.expire_direct_catalog_orders() from public, anon, authenticated;
