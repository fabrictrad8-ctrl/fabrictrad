-- Real WhatsApp Cloud API catalogue ingestion.
-- Persists image/text messages long enough to pair separate messages from the same seller.

ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS admin_review_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_products_source_check') THEN
    ALTER TABLE public.seller_products
      ADD CONSTRAINT seller_products_source_check
      CHECK (source IN ('manual', 'csv', 'whatsapp'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_products_approval_status_check') THEN
    ALTER TABLE public.seller_products
      ADD CONSTRAINT seller_products_approval_status_check
      CHECK (approval_status IN ('not_submitted', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_products_source_reference
  ON public.seller_products(source, source_reference)
  WHERE source_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_catalog_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid TEXT NOT NULL UNIQUE,
  sender_phone TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image')),
  text_content TEXT,
  media_id TEXT,
  media_mime_type TEXT,
  media_sha256 TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'unmatched', 'failed')),
  product_id UUID REFERENCES public.seller_products(id) ON DELETE SET NULL,
  error_message TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_catalog_pending
  ON public.whatsapp_catalog_messages(sender_phone, status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_catalog_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key TEXT NOT NULL UNIQUE,
  sender_phone TEXT NOT NULL,
  seller_id UUID REFERENCES public.seller_profiles(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.seller_products(id) ON DELETE SET NULL,
  message_ids TEXT[] NOT NULL DEFAULT '{}',
  parsed_details JSONB,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'unmatched', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_batches_sender
  ON public.whatsapp_catalog_batches(sender_phone, created_at DESC);

ALTER TABLE public.whatsapp_catalog_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_catalog_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_messages_admin_read ON public.whatsapp_catalog_messages;
CREATE POLICY whatsapp_messages_admin_read
  ON public.whatsapp_catalog_messages FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS whatsapp_batches_admin_read ON public.whatsapp_catalog_batches;
CREATE POLICY whatsapp_batches_admin_read
  ON public.whatsapp_catalog_batches FOR SELECT TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS whatsapp_catalog_messages_updated_at ON public.whatsapp_catalog_messages;
CREATE TRIGGER whatsapp_catalog_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_catalog_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS whatsapp_catalog_batches_updated_at ON public.whatsapp_catalog_batches;
CREATE TRIGGER whatsapp_catalog_batches_updated_at
  BEFORE UPDATE ON public.whatsapp_catalog_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resolve a WhatsApp sender to the seller whose verified account phone ends in the same
-- national number. This accommodates stored values with spaces, +91, dashes or brackets.
CREATE OR REPLACE FUNCTION public.resolve_whatsapp_seller(p_phone TEXT)
RETURNS TABLE (
  seller_id UUID,
  user_id UUID,
  seller_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.user_id,
    COALESCE(NULLIF(sp.display_name, ''), NULLIF(sp.legal_business_name, ''), up.full_name, 'Seller')
  FROM public.seller_profiles sp
  JOIN public.user_profiles up ON up.id = sp.user_id
  WHERE up.role = 'seller'::public.user_role
    AND up.is_active = TRUE
    AND sp.is_active = TRUE
    AND up.phone_verified = TRUE
    AND RIGHT(regexp_replace(COALESCE(up.phone, ''), '\D', '', 'g'), 10)
      = RIGHT(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_whatsapp_seller(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_whatsapp_seller(TEXT) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-product-images',
  'seller-product-images',
  TRUE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
