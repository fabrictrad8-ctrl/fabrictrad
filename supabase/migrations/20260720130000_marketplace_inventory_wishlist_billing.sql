-- Marketplace functionality: seller inventory, buyer wishlist, billing uploads,
-- and user language preference.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notification_digest_time TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS notification_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_preferred_language_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_preferred_language_check
      CHECK (preferred_language IN ('en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.seller_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  sku TEXT NOT NULL CHECK (char_length(trim(sku)) BETWEEN 1 AND 80),
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT,
  price_per_unit NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  unit TEXT NOT NULL DEFAULT 'mtr' CHECK (unit IN ('mtr', 'kg', 'piece', 'roll')),
  available_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  min_stock NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  moq INTEGER NOT NULL DEFAULT 3 CHECK (moq >= 1),
  gsm INTEGER CHECK (gsm IS NULL OR gsm > 0),
  width_inches NUMERIC(7,2) CHECK (width_inches IS NULL OR width_inches > 0),
  work_type TEXT NOT NULL DEFAULT 'Plain',
  image_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispatch_days INTEGER NOT NULL DEFAULT 3 CHECK (dispatch_days BETWEEN 1 AND 30),
  origin_city TEXT,
  origin_state TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_seller_products_seller_id ON public.seller_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_products_public ON public.seller_products(status, category, updated_at DESC);
ALTER TABLE public.seller_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_seller_products" ON public.seller_products;
CREATE POLICY "public_read_active_seller_products"
  ON public.seller_products FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.id = seller_id
        AND sp.is_active = true
        AND sp.verification_status = 'verified'::public.seller_status
    )
  );

DROP POLICY IF EXISTS "sellers_manage_own_products" ON public.seller_products;
CREATE POLICY "sellers_manage_own_products"
  ON public.seller_products FOR ALL TO authenticated
  USING (seller_id = public.my_seller_id())
  WITH CHECK (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "admins_manage_seller_products" ON public.seller_products;
CREATE POLICY "admins_manage_seller_products"
  ON public.seller_products FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS seller_products_updated_at ON public.seller_products;
CREATE TRIGGER seller_products_updated_at
  BEFORE UPDATE ON public.seller_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.buyer_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  product_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_key)
);

CREATE INDEX IF NOT EXISTS idx_buyer_wishlist_user ON public.buyer_wishlist(user_id, created_at DESC);
ALTER TABLE public.buyer_wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers_manage_own_wishlist" ON public.buyer_wishlist;
CREATE POLICY "buyers_manage_own_wishlist"
  ON public.buyer_wishlist FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_wishlist" ON public.buyer_wishlist;
CREATE POLICY "admins_read_wishlist"
  ON public.buyer_wishlist FOR SELECT TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS buyer_wishlist_updated_at ON public.buyer_wishlist;
CREATE TRIGGER buyer_wishlist_updated_at
  BEFORE UPDATE ON public.buyer_wishlist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.seller_billing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  bulk_order_id UUID REFERENCES public.bulk_orders(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'invoice'
    CHECK (document_type IN ('invoice', 'eway_bill', 'packing_list', 'credit_note', 'other')),
  invoice_number TEXT,
  amount NUMERIC(12,2) CHECK (amount IS NULL OR amount >= 0),
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'verified', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_billing_seller ON public.seller_billing_documents(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_billing_order ON public.seller_billing_documents(bulk_order_id);
ALTER TABLE public.seller_billing_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sellers_read_own_billing_documents" ON public.seller_billing_documents;
CREATE POLICY "sellers_read_own_billing_documents"
  ON public.seller_billing_documents FOR SELECT TO authenticated
  USING (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "sellers_upload_own_billing_documents" ON public.seller_billing_documents;
CREATE POLICY "sellers_upload_own_billing_documents"
  ON public.seller_billing_documents FOR INSERT TO authenticated
  WITH CHECK (seller_id = public.my_seller_id() AND status = 'uploaded');

DROP POLICY IF EXISTS "sellers_delete_unreviewed_billing_documents" ON public.seller_billing_documents;
CREATE POLICY "sellers_delete_unreviewed_billing_documents"
  ON public.seller_billing_documents FOR DELETE TO authenticated
  USING (seller_id = public.my_seller_id() AND status = 'uploaded');

DROP POLICY IF EXISTS "admins_manage_billing_documents" ON public.seller_billing_documents;
CREATE POLICY "admins_manage_billing_documents"
  ON public.seller_billing_documents FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS seller_billing_documents_updated_at ON public.seller_billing_documents;
CREATE TRIGGER seller_billing_documents_updated_at
  BEFORE UPDATE ON public.seller_billing_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-billing', 'seller-billing', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "seller_billing_owner_upload" ON storage.objects;
CREATE POLICY "seller_billing_owner_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seller-billing' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "seller_billing_owner_read" ON storage.objects;
CREATE POLICY "seller_billing_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'seller-billing' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS "seller_billing_owner_delete" ON storage.objects;
CREATE POLICY "seller_billing_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'seller-billing' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

CREATE TABLE IF NOT EXISTS public.discount_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 120),
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('Website-wide','Product-specific','Category','Seller-specific','Buyer-specific','First-order','Flash Sale','Coupon Code','Festival Offer','Free Shipping')),
  target_product_key TEXT,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  max_discount NUMERIC(12,2) CHECK (max_discount IS NULL OR max_discount >= 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  funded_by TEXT NOT NULL DEFAULT 'FabricTrad' CHECK (funded_by IN ('FabricTrad','Seller','Shared 50/50','Custom Split')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','paused','expired')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (campaign_type <> 'Product-specific' OR nullif(trim(target_product_key), '') IS NOT NULL)
);

ALTER TABLE public.discount_campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_discount_campaigns_public ON public.discount_campaigns(status, start_date, end_date);
DROP POLICY IF EXISTS "public_read_active_discount_campaigns" ON public.discount_campaigns;
CREATE POLICY "public_read_active_discount_campaigns" ON public.discount_campaigns FOR SELECT TO anon, authenticated
  USING (status = 'active' AND CURRENT_DATE BETWEEN start_date AND end_date AND (usage_limit IS NULL OR usage_count < usage_limit));
DROP POLICY IF EXISTS "admins_manage_discount_campaigns" ON public.discount_campaigns;
CREATE POLICY "admins_manage_discount_campaigns" ON public.discount_campaigns FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS discount_campaigns_updated_at ON public.discount_campaigns;
CREATE TRIGGER discount_campaigns_updated_at BEFORE UPDATE ON public.discount_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bulk_orders ADD COLUMN IF NOT EXISTS discount_campaign_id UUID REFERENCES public.discount_campaigns(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.record_discount_redemption(p_campaign_id UUID, p_order_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bulk_orders bo WHERE bo.id = p_order_id AND bo.buyer_id = auth.uid() AND bo.discount_campaign_id = p_campaign_id) THEN RAISE EXCEPTION 'Order does not belong to the current buyer or campaign'; END IF;
  UPDATE public.discount_campaigns SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id AND status = 'active' AND CURRENT_DATE BETWEEN start_date AND end_date AND (usage_limit IS NULL OR usage_count < usage_limit);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.record_discount_redemption(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_discount_redemption(UUID, UUID) TO authenticated;

DROP INDEX IF EXISTS public.idx_seller_registrations_user_id_unique;
CREATE UNIQUE INDEX idx_seller_registrations_user_id_unique ON public.seller_registrations(user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-registration-documents','seller-registration-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "seller_registration_document_owner_upload" ON storage.objects;
CREATE POLICY "seller_registration_document_owner_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'seller-registration-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "seller_registration_document_owner_read" ON storage.objects;
CREATE POLICY "seller_registration_document_owner_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'seller-registration-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS "seller_registration_document_owner_update" ON storage.objects;
CREATE POLICY "seller_registration_document_owner_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'seller-registration-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())) WITH CHECK (bucket_id = 'seller-registration-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS "seller_registration_document_owner_delete" ON storage.objects;
CREATE POLICY "seller_registration_document_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'seller-registration-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
