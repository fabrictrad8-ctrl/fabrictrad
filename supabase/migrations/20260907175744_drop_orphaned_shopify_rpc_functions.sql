-- These RPC functions referenced public.shopify_product_links, which was
-- dropped in 20260907175548_drop_unused_shopify_integration_tables.sql.
-- Nothing in the application calls either function.
drop function if exists public.get_shopify_purchase_rule(text, text);
drop function if exists public.resolve_shopify_marketplace_product(text);
