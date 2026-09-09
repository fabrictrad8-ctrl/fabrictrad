-- Reconstructed from the applied live migration 20260908072334_add_seller_product_compare_at_price.
-- Public storefront discount: an optional "was" price shown crossed out next to the live price,
-- the same pattern Shopify uses for simple product-level sales (not tied to wholesale catalog pricing).
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS compare_at_price numeric;

ALTER TABLE public.seller_products
  DROP CONSTRAINT IF EXISTS seller_products_compare_at_price_chk;
ALTER TABLE public.seller_products
  ADD CONSTRAINT seller_products_compare_at_price_chk
  CHECK (compare_at_price IS NULL OR compare_at_price > price_per_unit);
