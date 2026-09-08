-- The Shopify integration (admin API client, webhook handler, and storefront
-- sync) has been removed from the application. These tables no longer have
-- any code path writing to or reading from them; no other table has a
-- foreign key into any of them (verified before writing this migration).
drop table if exists public.shopify_checkout_authorizations;
drop table if exists public.shopify_customer_links;
drop table if exists public.shopify_order_links;
drop table if exists public.shopify_product_links;
drop table if exists public.shopify_refund_operations;
drop table if exists public.shopify_seller_order_items;
drop table if exists public.shopify_webhook_events;
