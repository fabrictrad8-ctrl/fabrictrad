-- In-app AI catalogue studio, product media, retail visibility and package formats.

ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS sale_channel TEXT NOT NULL DEFAULT 'b2b',
  ADD COLUMN IF NOT EXISTS package_format TEXT NOT NULL DEFAULT 'Fabric Only';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seller_products_sale_channel_check'
  ) THEN
    ALTER TABLE public.seller_products
      ADD CONSTRAINT seller_products_sale_channel_check
      CHECK (sale_channel IN ('b2b', 'retail', 'both'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seller_products_package_format_check'
  ) THEN
    ALTER TABLE public.seller_products
      ADD CONSTRAINT seller_products_package_format_check
      CHECK (package_format IN (
        'Fabric Only',
        'Full Set',
        'Top',
        'Bottom',
        'Top & Bottom',
        'Additional Accessory',
        'Other'
      ));
  END IF;
END $$;

-- Replace older source checks so products and variants can come from the in-app assistant.
ALTER TABLE public.seller_products DROP CONSTRAINT IF EXISTS seller_products_source_check;
ALTER TABLE public.seller_products
  ADD CONSTRAINT seller_products_source_check
  CHECK (source IN ('manual', 'csv', 'whatsapp', 'assistant'));

ALTER TABLE public.seller_product_variants DROP CONSTRAINT IF EXISTS seller_product_variants_source_check;
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.seller_product_variants'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source%manual%csv%whatsapp%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.seller_product_variants DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.seller_product_variants
  ADD CONSTRAINT seller_product_variants_source_check
  CHECK (source IN ('manual', 'csv', 'whatsapp', 'assistant'));

CREATE TABLE IF NOT EXISTS public.seller_product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.seller_product_variants(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  view_type TEXT NOT NULL DEFAULT 'other'
    CHECK (view_type IN ('front', 'back', 'detail', 'reel', 'other')),
  public_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 52428800),
  duration_seconds NUMERIC(6,2)
    CHECK (duration_seconds IS NULL OR (duration_seconds > 0 AND duration_seconds <= 20.5)),
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, storage_path),
  CHECK (
    (media_type = 'image' AND duration_seconds IS NULL)
    OR (media_type = 'video' AND duration_seconds IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_seller_product_media_product
  ON public.seller_product_media(product_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_seller_product_media_variant
  ON public.seller_product_media(variant_id, sort_order, created_at)
  WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seller_product_media_seller
  ON public.seller_product_media(seller_id, created_at DESC);

ALTER TABLE public.seller_product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_active_product_media ON public.seller_product_media;
CREATE POLICY public_read_active_product_media
  ON public.seller_product_media FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.seller_products product
      JOIN public.seller_profiles seller ON seller.id = product.seller_id
      WHERE product.id = seller_product_media.product_id
        AND product.seller_id = seller_product_media.seller_id
        AND product.status = 'active'
        AND seller.is_active = TRUE
        AND seller.verification_status = 'verified'::public.seller_status
        AND (
          seller_product_media.variant_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.seller_product_variants variant
            WHERE variant.id = seller_product_media.variant_id
              AND variant.product_id = seller_product_media.product_id
              AND variant.status = 'active'
              AND variant.approval_status = 'approved'
          )
        )
    )
  );

DROP POLICY IF EXISTS sellers_manage_own_product_media ON public.seller_product_media;
CREATE POLICY sellers_manage_own_product_media
  ON public.seller_product_media FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id())
  WITH CHECK (
    seller_id = public.my_seller_id()
    AND EXISTS (
      SELECT 1 FROM public.seller_products product
      WHERE product.id = seller_product_media.product_id
        AND product.seller_id = seller_product_media.seller_id
    )
    AND (
      variant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.seller_product_variants variant
        WHERE variant.id = seller_product_media.variant_id
          AND variant.product_id = seller_product_media.product_id
          AND variant.seller_id = seller_product_media.seller_id
      )
    )
  );

DROP POLICY IF EXISTS admins_manage_product_media ON public.seller_product_media;
CREATE POLICY admins_manage_product_media
  ON public.seller_product_media FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS seller_product_media_updated_at ON public.seller_product_media;
CREATE TRIGGER seller_product_media_updated_at
  BEFORE UPDATE ON public.seller_product_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seller-product-media',
  'seller-product-media',
  TRUE,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS seller_product_media_owner_upload ON storage.objects;
CREATE POLICY seller_product_media_owner_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seller-product-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS seller_product_media_owner_update ON storage.objects;
CREATE POLICY seller_product_media_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'seller-product-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'seller-product-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS seller_product_media_public_read ON storage.objects;
CREATE POLICY seller_product_media_public_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'seller-product-media');

DROP POLICY IF EXISTS seller_product_media_owner_delete ON storage.objects;
CREATE POLICY seller_product_media_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'seller-product-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- Buyer order requests generated from live catalogue products.
CREATE TABLE IF NOT EXISTS public.catalog_order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.seller_product_variants(id) ON DELETE SET NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('mtr', 'kg', 'piece', 'roll')),
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal > 0),
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'paid', 'fulfilled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_order_requests_buyer
  ON public.catalog_order_requests(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_order_requests_seller
  ON public.catalog_order_requests(seller_id, status, created_at DESC);

ALTER TABLE public.catalog_order_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buyers_create_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_create_catalog_order_requests
  ON public.catalog_order_requests FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.get_my_role() = 'buyer'
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.seller_products product
      WHERE product.id = catalog_order_requests.product_id
        AND product.seller_id = catalog_order_requests.seller_id
        AND product.status = 'active'
    )
  );

DROP POLICY IF EXISTS buyers_read_own_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_read_own_catalog_order_requests
  ON public.catalog_order_requests FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS sellers_manage_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY sellers_manage_catalog_order_requests
  ON public.catalog_order_requests FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id())
  WITH CHECK (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS admins_manage_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY admins_manage_catalog_order_requests
  ON public.catalog_order_requests FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS catalog_order_requests_updated_at ON public.catalog_order_requests;
CREATE TRIGGER catalog_order_requests_updated_at
  BEFORE UPDATE ON public.catalog_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
