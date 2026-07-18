-- Migration: Bulk orders, categories, courier settings, MOQ, taxation
-- Timestamp: 20260718120000

-- ─── Seller Categories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  parent_id UUID REFERENCES public.seller_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seller_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_categories' AND policyname = 'Sellers manage own categories') THEN
    CREATE POLICY "Sellers manage own categories" ON public.seller_categories
      FOR ALL USING (seller_id IN (SELECT id FROM public.seller_profiles WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_categories' AND policyname = 'Public read categories') THEN
    CREATE POLICY "Public read categories" ON public.seller_categories
      FOR SELECT USING (true);
  END IF;
END $$;

-- ─── Bulk Orders ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulk_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id),
  seller_id UUID REFERENCES public.seller_profiles(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'quote_sent', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled')),
  buyer_name TEXT,
  buyer_company TEXT,
  buyer_gstin TEXT,
  buyer_email TEXT,
  gross_total NUMERIC(12,2) DEFAULT 0,
  discount_total NUMERIC(12,2) DEFAULT 0,
  gst_total NUMERIC(12,2) DEFAULT 0,
  net_total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  quote_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bulk_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_order_id UUID NOT NULL REFERENCES public.bulk_orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT,
  price_per_mtr NUMERIC(10,2) NOT NULL,
  quantity_mtrs INTEGER NOT NULL CHECK (quantity_mtrs >= 3),
  moq_tier INTEGER NOT NULL CHECK (moq_tier IN (3, 6, 9, 12)),
  discount_pct NUMERIC(5,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 5,
  line_total NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bulk_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bulk_orders' AND policyname = 'Buyers manage own bulk orders') THEN
    CREATE POLICY "Buyers manage own bulk orders" ON public.bulk_orders
      FOR ALL USING (buyer_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bulk_order_items' AND policyname = 'Bulk order items access') THEN
    CREATE POLICY "Bulk order items access" ON public.bulk_order_items
      FOR ALL USING (
        bulk_order_id IN (SELECT id FROM public.bulk_orders WHERE buyer_id = auth.uid())
      );
  END IF;
END $$;

-- ─── Seller Courier Settings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  seller_id UUID REFERENCES public.seller_profiles(id),
  courier_type TEXT NOT NULL CHECK (courier_type IN ('shiprocket', 'local')),
  courier_name TEXT,
  awb_number TEXT,
  tracking_url TEXT,
  estimated_delivery DATE,
  shiprocket_order_id TEXT,
  shiprocket_shipment_id TEXT,
  tracking_events JSONB DEFAULT '[]',
  last_tracked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seller_shipments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_shipments' AND policyname = 'Sellers manage own shipments') THEN
    CREATE POLICY "Sellers manage own shipments" ON public.seller_shipments
      FOR ALL USING (seller_id IN (SELECT id FROM public.seller_profiles WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_shipments' AND policyname = 'Public read shipments by order') THEN
    CREATE POLICY "Public read shipments by order" ON public.seller_shipments
      FOR SELECT USING (true);
  END IF;
END $$;

-- ─── Seller MOQ Settings ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seller_profiles' AND column_name = 'moq_metres') THEN
    ALTER TABLE public.seller_profiles ADD COLUMN moq_metres INTEGER DEFAULT 3 CHECK (moq_metres IN (3, 6, 9, 12));
  END IF;
END $$;

-- ─── Taxation Split Tracking ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.taxation_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  transaction_id TEXT,
  gross_amount NUMERIC(12,2) NOT NULL,
  gst_amount NUMERIC(12,2) NOT NULL,
  gst_rate NUMERIC(5,2) NOT NULL,
  platform_fee NUMERIC(12,2) DEFAULT 0,
  seller_payout NUMERIC(12,2) NOT NULL,
  split_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  razorpay_transfer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.taxation_splits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'taxation_splits' AND policyname = 'Admins manage taxation splits') THEN
    CREATE POLICY "Admins manage taxation splits" ON public.taxation_splits
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ─── Exchange Window Constraint ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'exchange_window_hours') THEN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS exchange_window_hours INTEGER DEFAULT 12;
  END IF;
END $$;

-- ─── Updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_seller_categories_updated_at') THEN
    CREATE TRIGGER set_seller_categories_updated_at
      BEFORE UPDATE ON public.seller_categories
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_bulk_orders_updated_at') THEN
    CREATE TRIGGER set_bulk_orders_updated_at
      BEFORE UPDATE ON public.bulk_orders
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_seller_shipments_updated_at') THEN
    CREATE TRIGGER set_seller_shipments_updated_at
      BEFORE UPDATE ON public.seller_shipments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
