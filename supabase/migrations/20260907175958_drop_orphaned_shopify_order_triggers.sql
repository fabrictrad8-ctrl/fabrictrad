-- Both triggers only ever acted on rows where commerce_source = 'shopify',
-- which the application can no longer create now that the Shopify
-- integration is removed. Left in place they are a landmine: each function
-- body still references tables dropped in
-- 20260907175548_drop_unused_shopify_integration_tables.sql, so any row that
-- ever did carry commerce_source = 'shopify' would raise on write.
drop trigger if exists trg_enforce_shopify_order_checkout_authorization on public.orders;
drop trigger if exists refresh_shopify_seller_settlement_entry_trigger on public.orders;

drop function if exists public.enforce_shopify_order_checkout_authorization();
drop function if exists public.refresh_shopify_seller_settlement_entry();
-- No live trigger referenced this function; it called
-- validate_shopify_purchase_line_for_user, which is dropped alongside it.
drop function if exists public.enforce_shopify_order_item_purchase_rule();
drop function if exists public.validate_shopify_purchase_line_for_user(uuid, text, text, numeric);
