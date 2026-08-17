-- Mobile-first WhatsApp -> seller dashboard ingestion.
-- Raw WhatsApp credentials never reach the browser. Incoming media stays in a
-- private bucket until the seller explicitly publishes a catalogue product.

CREATE TABLE IF NOT EXISTS public.whatsapp_catalog_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  wa_message_id text NOT NULL UNIQUE,
  from_phone text NOT NULL,
  message_type text NOT NULL,
  message_text text,
  media_id text,
  media_storage_path text,
  media_mime_type text,
  parsed_draft jsonb,
  product_id uuid REFERENCES public.seller_products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (
    status IN ('received','parsed','draft_created','needs_review','ignored','failed')
  ),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_catalog_ingestions_seller_received_idx
  ON public.whatsapp_catalog_ingestions (seller_id, received_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_catalog_ingestions_user_received_idx
  ON public.whatsapp_catalog_ingestions (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_catalog_ingestions_status_idx
  ON public.whatsapp_catalog_ingestions (status, received_at DESC);

ALTER TABLE public.whatsapp_catalog_ingestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_catalog_ingestions_read_own ON public.whatsapp_catalog_ingestions;
CREATE POLICY whatsapp_catalog_ingestions_read_own
ON public.whatsapp_catalog_ingestions
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.whatsapp_catalog_ingestions FROM anon, authenticated;
GRANT SELECT ON TABLE public.whatsapp_catalog_ingestions TO authenticated;
GRANT ALL ON TABLE public.whatsapp_catalog_ingestions TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-whatsapp-inbox',
  'seller-whatsapp-inbox',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/3gpp',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON TABLE public.whatsapp_catalog_ingestions IS
  'Private inbound WhatsApp catalogue messages mapped to the authenticated seller dashboard.';
