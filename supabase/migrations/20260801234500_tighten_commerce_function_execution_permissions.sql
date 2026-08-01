-- Trigger functions must not be callable through PostgREST, and order submission requires authentication.

revoke all on function public.enforce_catalog_order_policy_and_tax() from public, anon, authenticated;
revoke all on function public.require_verified_gstin_for_live_listing() from public, anon, authenticated;

revoke all on function public.submit_catalog_order_request(
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  text,
  numeric,
  boolean,
  text
) from public, anon;
grant execute on function public.submit_catalog_order_request(
  uuid,
  uuid,
  numeric,
  uuid,
  uuid,
  text,
  text,
  numeric,
  boolean,
  text
) to authenticated;
