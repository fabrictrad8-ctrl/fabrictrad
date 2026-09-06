-- Remove inherited PUBLIC execution from internal trigger functions.
revoke execute on function public.enforce_shopify_order_checkout_authorization() from public;
revoke execute on function public.refresh_shopify_seller_settlement_entry() from public;
revoke execute on function public.increment_review_helpful(uuid) from public;

-- Internal trigger functions remain executable by the database owner/service role.
grant execute on function public.enforce_shopify_order_checkout_authorization() to service_role;
grant execute on function public.refresh_shopify_seller_settlement_entry() to service_role;

-- Helpful review voting is an authenticated user action, not an anonymous RPC.
grant execute on function public.increment_review_helpful(uuid) to authenticated;
