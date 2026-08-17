-- 3D trial-room foundation. The current buyer experience remains the existing
-- AI image try-on; this table deliberately separates future 3D assets from
-- seller product/media rows so a GLB/material pipeline can be added safely.

CREATE TABLE IF NOT EXISTS public.product_trial_room_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.seller_product_variants(id) ON DELETE CASCADE,
  asset_kind text NOT NULL CHECK (
    asset_kind IN ('fabric_texture','normal_map','roughness_map','garment_glb','garment_usdz','thumbnail','measurement_profile')
  ),
  asset_format text NOT NULL,
  storage_path text,
  external_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','ready','failed','archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_id, asset_kind)
);

CREATE INDEX IF NOT EXISTS product_trial_room_assets_product_idx
  ON public.product_trial_room_assets (product_id, status);
CREATE INDEX IF NOT EXISTS product_trial_room_assets_seller_idx
  ON public.product_trial_room_assets (seller_id, status);

ALTER TABLE public.product_trial_room_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trial_room_assets_seller_read_own ON public.product_trial_room_assets;
CREATE POLICY trial_room_assets_seller_read_own
ON public.product_trial_room_assets
FOR SELECT TO authenticated
USING (
  seller_id IN (
    SELECT sp.id FROM public.seller_profiles sp WHERE sp.user_id = (SELECT auth.uid())
  )
  OR (
    status = 'ready'
    AND EXISTS (
      SELECT 1
      FROM public.seller_products product
      WHERE product.id = product_trial_room_assets.product_id
        AND product.seller_id = product_trial_room_assets.seller_id
        AND product.status = 'active'
        AND product.approval_status = 'approved'
    )
  )
);

DROP POLICY IF EXISTS trial_room_assets_seller_insert_own ON public.product_trial_room_assets;
CREATE POLICY trial_room_assets_seller_insert_own
ON public.product_trial_room_assets
FOR INSERT TO authenticated
WITH CHECK (
  seller_id IN (
    SELECT sp.id FROM public.seller_profiles sp WHERE sp.user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.seller_products product
    WHERE product.id = product_trial_room_assets.product_id
      AND product.seller_id = product_trial_room_assets.seller_id
  )
  AND (
    variant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.seller_product_variants variant
      WHERE variant.id = product_trial_room_assets.variant_id
        AND variant.product_id = product_trial_room_assets.product_id
        AND variant.seller_id = product_trial_room_assets.seller_id
    )
  )
);

DROP POLICY IF EXISTS trial_room_assets_seller_update_own ON public.product_trial_room_assets;
CREATE POLICY trial_room_assets_seller_update_own
ON public.product_trial_room_assets
FOR UPDATE TO authenticated
USING (
  seller_id IN (
    SELECT sp.id FROM public.seller_profiles sp WHERE sp.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  seller_id IN (
    SELECT sp.id FROM public.seller_profiles sp WHERE sp.user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.seller_products product
    WHERE product.id = product_trial_room_assets.product_id
      AND product.seller_id = product_trial_room_assets.seller_id
  )
  AND (
    variant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.seller_product_variants variant
      WHERE variant.id = product_trial_room_assets.variant_id
        AND variant.product_id = product_trial_room_assets.product_id
        AND variant.seller_id = product_trial_room_assets.seller_id
    )
  )
);

REVOKE ALL ON TABLE public.product_trial_room_assets FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.product_trial_room_assets TO authenticated;
GRANT ALL ON TABLE public.product_trial_room_assets TO service_role;

COMMENT ON TABLE public.product_trial_room_assets IS
  'Future 3D trial-room assets (GLB/USDZ/material maps); separate from the existing 2D AI try-on.';
