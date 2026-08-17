-- Cover the remaining foreign keys introduced by the mobile/WhatsApp and
-- trial-room foundations. These support product linkage and variant cleanup
-- without forcing sequential scans as the catalogue grows.

CREATE INDEX IF NOT EXISTS whatsapp_catalog_ingestions_product_id_idx
  ON public.whatsapp_catalog_ingestions (product_id)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_trial_room_assets_variant_id_idx
  ON public.product_trial_room_assets (variant_id)
  WHERE variant_id IS NOT NULL;
