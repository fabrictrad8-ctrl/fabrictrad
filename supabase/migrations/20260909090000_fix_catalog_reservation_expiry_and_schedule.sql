-- Abandoned checkouts were permanently consuming seller stock: stock is committed
-- at order creation, but expire_direct_catalog_orders() was never scheduled AND
-- would have thrown "Not authorized to update this order" if it had been, because
-- protect_catalog_order_request_state() only accepts service_role or an admin.
--
-- Two fixes here:
--  1. Expire on the real payment due date instead of a blanket 30-minute cutoff,
--     so B2B credit-term orders (net_7/net_30/net_90) are never wrongly cancelled.
--  2. Let the sweeper identify itself as the system actor for its own statement,
--     restoring the caller's JWT afterwards so it cannot leave elevated context behind.
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
       (payment_due_at is not null and payment_due_at < now())
       or (payment_due_at is null and created_at < now() - interval '30 minutes')
     );
  get diagnostics affected = row_count;

  perform set_config('request.jwt.claims', coalesce(prev_claims, ''), true);
  return affected;
end;
$function$;

-- This function self-elevates for its own statement, so it must never be callable
-- straight off the public REST surface.
revoke execute on function public.expire_direct_catalog_orders() from public, anon, authenticated;

create extension if not exists pg_cron;

-- Release abandoned checkout reservations back to seller stock every 5 minutes.
-- Without this, stock committed at order-creation time is never returned when a
-- buyer walks away from checkout.
select cron.schedule(
  'expire-catalog-reservations',
  '*/5 * * * *',
  $$select public.expire_direct_catalog_orders();$$
);
