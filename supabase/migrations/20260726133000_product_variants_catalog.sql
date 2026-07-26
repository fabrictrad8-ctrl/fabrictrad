-- Parent fabric listings with per-colour and per-design inventory variants.

ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS variant_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variant_colors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS variant_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_terms TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.seller_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  variant_key TEXT NOT NULL,
  variant_code TEXT NOT NULL,
  color_name TEXT NOT NULL CHECK (char_length(trim(color_name)) BETWEEN 1 AND 100),
  color_hex TEXT CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  design_name TEXT NOT NULL DEFAULT 'Standard',
  description TEXT,
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  unit TEXT NOT NULL DEFAULT 'mtr' CHECK (unit IN ('mtr', 'kg', 'piece', 'roll')),
  available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  moq NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (moq > 0),
  image_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'whatsapp')),
  source_reference TEXT,
  approval_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (approval_status IN ('not_submitted', 'pending', 'approved', 'rejected')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  admin_review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, variant_key),
  UNIQUE (seller_id, variant_code)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON public.seller_product_variants(product_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_variants_seller
  ON public.seller_product_variants(seller_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_variants_search
  ON public.seller_product_variants USING gin (
    to_tsvector('simple', coalesce(color_name, '') || ' ' || coalesce(design_name, '') || ' ' || coalesce(description, ''))
  );

ALTER TABLE public.seller_product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_active_product_variants ON public.seller_product_variants;
CREATE POLICY public_read_active_product_variants
  ON public.seller_product_variants FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND approval_status = 'approved'
    AND EXISTS (
      SELECT 1
      FROM public.seller_products product
      JOIN public.seller_profiles seller ON seller.id = product.seller_id
      WHERE product.id = seller_product_variants.product_id
        AND product.seller_id = seller_product_variants.seller_id
        AND product.status = 'active'
        AND seller.is_active = TRUE
        AND seller.verification_status = 'verified'::public.seller_status
    )
  );

DROP POLICY IF EXISTS sellers_manage_own_product_variants ON public.seller_product_variants;
CREATE POLICY sellers_manage_own_product_variants
  ON public.seller_product_variants FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id())
  WITH CHECK (
    seller_id = public.my_seller_id()
    AND EXISTS (
      SELECT 1
      FROM public.seller_products product
      WHERE product.id = seller_product_variants.product_id
        AND product.seller_id = seller_product_variants.seller_id
    )
  );

DROP POLICY IF EXISTS admins_manage_product_variants ON public.seller_product_variants;
CREATE POLICY admins_manage_product_variants
  ON public.seller_product_variants FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS seller_product_variants_updated_at ON public.seller_product_variants;
CREATE TRIGGER seller_product_variants_updated_at
  BEFORE UPDATE ON public.seller_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_product_variant_rollup(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rollup RECORD;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status <> 'archived')::INTEGER AS variant_count,
    COALESCE(
      ARRAY_AGG(DISTINCT color_name ORDER BY color_name) FILTER (WHERE status <> 'archived'),
      '{}'::TEXT[]
    ) AS colors,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', id,
          'color', color_name,
          'colorHex', color_hex,
          'design', design_name,
          'price', price_per_unit,
          'unit', unit,
          'available', GREATEST(available_quantity - reserved_quantity, 0),
          'moq', moq,
          'image', image_url,
          'status', status,
          'approvalStatus', approval_status
        ) ORDER BY color_name, design_name
      ) FILTER (WHERE status <> 'archived'),
      '[]'::JSONB
    ) AS summary,
    COALESCE(SUM(GREATEST(available_quantity - reserved_quantity, 0)) FILTER (WHERE status <> 'archived'), 0) AS total_available,
    MIN(price_per_unit) FILTER (WHERE status <> 'archived') AS minimum_price,
    MIN(image_url) FILTER (WHERE status <> 'archived' AND image_url IS NOT NULL) AS first_image,
    COALESCE(
      STRING_AGG(
        DISTINCT trim(color_name || ' ' || design_name || ' ' || COALESCE(description, '')),
        ' '
      ) FILTER (WHERE status <> 'archived'),
      ''
    ) AS variant_search
  INTO rollup
  FROM public.seller_product_variants
  WHERE product_id = p_product_id;

  UPDATE public.seller_products
  SET
    variant_count = COALESCE(rollup.variant_count, 0),
    variant_colors = COALESCE(rollup.colors, '{}'::TEXT[]),
    variant_summary = COALESCE(rollup.summary, '[]'::JSONB),
    search_terms = trim(
      COALESCE(name, '') || ' ' ||
      COALESCE(category, '') || ' ' ||
      COALESCE(work_type, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(rollup.variant_search, '')
    ),
    available_quantity = CASE
      WHEN COALESCE(rollup.variant_count, 0) > 0 THEN COALESCE(rollup.total_available, 0)
      ELSE available_quantity
    END,
    price_per_unit = CASE
      WHEN COALESCE(rollup.variant_count, 0) > 0 AND rollup.minimum_price IS NOT NULL THEN rollup.minimum_price
      ELSE price_per_unit
    END,
    image_url = COALESCE(image_url, rollup.first_image),
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_variant_rollup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_product_variant_rollup(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_product_variant_rollup_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_product_variant_rollup(COALESCE(NEW.product_id, OLD.product_id));
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM public.sync_product_variant_rollup(OLD.product_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS seller_product_variants_rollup ON public.seller_product_variants;
CREATE TRIGGER seller_product_variants_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.seller_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_variant_rollup_trigger();

UPDATE public.seller_products
SET search_terms = trim(
  COALESCE(name, '') || ' ' ||
  COALESCE(category, '') || ' ' ||
  COALESCE(work_type, '') || ' ' ||
  COALESCE(description, '')
)
WHERE search_terms = '';
