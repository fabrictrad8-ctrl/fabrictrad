-- PostgREST upsert needs inferable unique constraints. PostgreSQL unique constraints
-- still allow multiple NULL values, so they remain suitable for the two optional order kinds.

DROP INDEX IF EXISTS public.seller_shipments_bulk_order_unique;
DROP INDEX IF EXISTS public.seller_shipments_catalog_order_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seller_shipments'::regclass
      AND conname = 'seller_shipments_bulk_order_id_key'
  ) THEN
    ALTER TABLE public.seller_shipments
      ADD CONSTRAINT seller_shipments_bulk_order_id_key UNIQUE (bulk_order_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seller_shipments'::regclass
      AND conname = 'seller_shipments_catalog_order_id_key'
  ) THEN
    ALTER TABLE public.seller_shipments
      ADD CONSTRAINT seller_shipments_catalog_order_id_key UNIQUE (catalog_order_id);
  END IF;
END $$;
