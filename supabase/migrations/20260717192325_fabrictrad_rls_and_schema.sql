-- FabricTrad: Core Schema + RLS Policies
-- Migration: 20260717192325_fabrictrad_rls_and_schema.sql

-- ============================================================
-- 1. ENUMS
-- ============================================================
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin_staff', 'seller', 'buyer');

DROP TYPE IF EXISTS public.seller_status CASCADE;
CREATE TYPE public.seller_status AS ENUM (
  'registration_started', 'phone_unverified', 'email_unverified',
  'profile_incomplete', 'documents_submitted', 'automated_review',
  'manual_review', 'additional_docs_required', 'verified',
  'rejected', 'suspended', 'permanently_blocked'
);

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM (
  'pending_seller_confirmation', 'seller_accepted', 'seller_rejected',
  'counter_offered', 'awaiting_payment', 'paid', 'processing',
  'ready_for_pickup', 'pickup_scheduled', 'picked_up',
  'in_transit', 'out_for_delivery', 'delivered',
  'delivery_failed', 'cancelled', 'returned', 'refunded'
);

DROP TYPE IF EXISTS public.payment_status CASCADE;
CREATE TYPE public.payment_status AS ENUM (
  'pending', 'initiated', 'captured', 'failed', 'refunded', 'partially_refunded'
);

DROP TYPE IF EXISTS public.shipment_status CASCADE;
CREATE TYPE public.shipment_status AS ENUM (
  'not_created', 'created', 'pickup_scheduled', 'picked_up',
  'in_transit', 'out_for_delivery', 'delivered',
  'delivery_failed', 'rto_initiated', 'rto_delivered', 'cancelled'
);

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- User profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  phone_verified BOOLEAN DEFAULT false,
  role public.user_role DEFAULT 'buyer'::public.user_role,
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Buyer profiles
CREATE TABLE IF NOT EXISTS public.buyer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  buyer_ref TEXT UNIQUE,
  business_name TEXT,
  business_type TEXT,
  gstin TEXT,
  gstin_verified BOOLEAN DEFAULT false,
  billing_address JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seller profiles
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seller_ref TEXT UNIQUE,
  legal_business_name TEXT NOT NULL DEFAULT '',
  display_name TEXT,
  business_type TEXT,
  gstin TEXT,
  gstin_verified BOOLEAN DEFAULT false,
  pan TEXT,
  verification_status public.seller_status DEFAULT 'registration_started'::public.seller_status,
  razorpay_linked_account_id TEXT,
  settlement_eligible BOOLEAN DEFAULT false,
  pickup_address JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seller bank profiles (sensitive — masked for staff)
CREATE TABLE IF NOT EXISTS public.seller_bank_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number_masked TEXT,
  ifsc_code TEXT,
  account_type TEXT DEFAULT 'savings',
  razorpay_fund_account_id TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref TEXT UNIQUE,
  buyer_id UUID NOT NULL REFERENCES public.buyer_profiles(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  status public.order_status DEFAULT 'pending_seller_confirmation'::public.order_status,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  shipping_charge NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'online',
  cod_enabled BOOLEAN DEFAULT false,
  shipping_address JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status public.payment_status DEFAULT 'pending'::public.payment_status,
  payment_method TEXT,
  captured_at TIMESTAMPTZ,
  failure_reason TEXT,
  webhook_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payment ledger (immutable)
CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  gross_amount NUMERIC(12,2) NOT NULL,
  platform_commission NUMERIC(12,2) DEFAULT 0,
  razorpay_fee NUMERIC(12,2) DEFAULT 0,
  gst_on_commission NUMERIC(12,2) DEFAULT 0,
  discount_funded_by_platform NUMERIC(12,2) DEFAULT 0,
  discount_funded_by_seller NUMERIC(12,2) DEFAULT 0,
  shipping_charge NUMERIC(12,2) DEFAULT 0,
  seller_payable NUMERIC(12,2) NOT NULL,
  razorpay_transfer_id TEXT,
  transfer_status TEXT DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Shipments
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_ref TEXT UNIQUE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES public.buyer_profiles(id) ON DELETE RESTRICT,
  shiprocket_order_id TEXT,
  shiprocket_shipment_id TEXT,
  awb_number TEXT,
  courier_name TEXT,
  status public.shipment_status DEFAULT 'not_created'::public.shipment_status,
  estimated_delivery TIMESTAMPTZ,
  pickup_address JSONB,
  delivery_address JSONB,
  weight_kg NUMERIC(6,3),
  dimensions JSONB,
  declared_value NUMERIC(12,2),
  tracking_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Shipment tracking events
CREATE TABLE IF NOT EXISTS public.shipment_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  raw_status TEXT,
  normalized_status TEXT,
  location TEXT,
  courier TEXT,
  event_time TIMESTAMPTZ,
  webhook_event_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user_id ON public.buyer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON public.seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_order_id ON public.payment_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_seller_id ON public.payment_ledger(seller_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_seller_id ON public.shipments(seller_id);
CREATE INDEX IF NOT EXISTS idx_shipments_buyer_id ON public.shipments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment_id ON public.shipment_tracking_events(shipment_id);

-- ============================================================
-- 4. HELPER FUNCTIONS (MUST BE BEFORE RLS POLICIES)
-- ============================================================

-- Get current user role from auth metadata (safe — no recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'buyer'
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' IN ('super_admin', 'admin_staff')
      OR raw_app_meta_data->>'role' IN ('super_admin', 'admin_staff')
    )
  )
$$;

-- Check if current user is a seller
CREATE OR REPLACE FUNCTION public.is_seller()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' = 'seller'
      OR raw_app_meta_data->>'role' = 'seller'
    )
  )
$$;

-- Get seller_profile id for current user
CREATE OR REPLACE FUNCTION public.my_seller_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT sp.id FROM public.seller_profiles sp
  JOIN public.user_profiles up ON sp.user_id = up.id
  WHERE up.id = auth.uid()
  LIMIT 1
$$;

-- Get buyer_profile id for current user
CREATE OR REPLACE FUNCTION public.my_buyer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT bp.id FROM public.buyer_profiles bp
  JOIN public.user_profiles up ON bp.user_id = up.id
  WHERE up.id = auth.uid()
  LIMIT 1
$$;

-- Handle new user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_bank_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- user_profiles: own record only (no function to avoid recursion)
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_full_access_user_profiles"
ON public.user_profiles FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- buyer_profiles: buyer sees own, admin sees all, seller cannot access
DROP POLICY IF EXISTS "buyer_manage_own_buyer_profile" ON public.buyer_profiles;
CREATE POLICY "buyer_manage_own_buyer_profile"
ON public.buyer_profiles FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_buyer_profiles" ON public.buyer_profiles;
CREATE POLICY "admin_full_access_buyer_profiles"
ON public.buyer_profiles FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- seller_profiles: seller sees own, admin sees all, buyer cannot access private fields
DROP POLICY IF EXISTS "seller_manage_own_seller_profile" ON public.seller_profiles;
CREATE POLICY "seller_manage_own_seller_profile"
ON public.seller_profiles FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_full_access_seller_profiles" ON public.seller_profiles;
CREATE POLICY "admin_full_access_seller_profiles"
ON public.seller_profiles FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public read of basic seller info (display_name, verified status) for marketplace
DROP POLICY IF EXISTS "public_read_seller_profiles" ON public.seller_profiles;
CREATE POLICY "public_read_seller_profiles"
ON public.seller_profiles FOR SELECT TO public
USING (is_active = true AND verification_status = 'verified'::public.seller_status);

-- seller_bank_profiles: only the seller and super_admin (not admin_staff)
DROP POLICY IF EXISTS "seller_manage_own_bank_profile" ON public.seller_bank_profiles;
CREATE POLICY "seller_manage_own_bank_profile"
ON public.seller_bank_profiles FOR ALL TO authenticated
USING (
  seller_id = public.my_seller_id()
)
WITH CHECK (
  seller_id = public.my_seller_id()
);

DROP POLICY IF EXISTS "super_admin_access_bank_profiles" ON public.seller_bank_profiles;
CREATE POLICY "super_admin_access_bank_profiles"
ON public.seller_bank_profiles FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'super_admin'
  )
);

-- orders: buyer sees own orders, seller sees orders assigned to them, admin sees all
DROP POLICY IF EXISTS "buyer_view_own_orders" ON public.orders;
CREATE POLICY "buyer_view_own_orders"
ON public.orders FOR SELECT TO authenticated
USING (buyer_id = public.my_buyer_id());

DROP POLICY IF EXISTS "buyer_create_orders" ON public.orders;
CREATE POLICY "buyer_create_orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (buyer_id = public.my_buyer_id());

DROP POLICY IF EXISTS "buyer_update_own_orders" ON public.orders;
CREATE POLICY "buyer_update_own_orders"
ON public.orders FOR UPDATE TO authenticated
USING (buyer_id = public.my_buyer_id())
WITH CHECK (buyer_id = public.my_buyer_id());

DROP POLICY IF EXISTS "seller_view_assigned_orders" ON public.orders;
CREATE POLICY "seller_view_assigned_orders"
ON public.orders FOR SELECT TO authenticated
USING (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "seller_update_assigned_orders" ON public.orders;
CREATE POLICY "seller_update_assigned_orders"
ON public.orders FOR UPDATE TO authenticated
USING (seller_id = public.my_seller_id())
WITH CHECK (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "admin_full_access_orders" ON public.orders;
CREATE POLICY "admin_full_access_orders"
ON public.orders FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- payments: buyer sees own, seller sees payments for their orders, admin sees all
DROP POLICY IF EXISTS "buyer_view_own_payments" ON public.payments;
CREATE POLICY "buyer_view_own_payments"
ON public.payments FOR SELECT TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE buyer_id = public.my_buyer_id()
  )
);

DROP POLICY IF EXISTS "buyer_create_payments" ON public.payments;
CREATE POLICY "buyer_create_payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders WHERE buyer_id = public.my_buyer_id()
  )
);

DROP POLICY IF EXISTS "seller_view_order_payments" ON public.payments;
CREATE POLICY "seller_view_order_payments"
ON public.payments FOR SELECT TO authenticated
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE seller_id = public.my_seller_id()
  )
);

DROP POLICY IF EXISTS "admin_full_access_payments" ON public.payments;
CREATE POLICY "admin_full_access_payments"
ON public.payments FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- payment_ledger: seller sees own, admin sees all, buyers cannot access
DROP POLICY IF EXISTS "seller_view_own_ledger" ON public.payment_ledger;
CREATE POLICY "seller_view_own_ledger"
ON public.payment_ledger FOR SELECT TO authenticated
USING (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "admin_full_access_payment_ledger" ON public.payment_ledger;
CREATE POLICY "admin_full_access_payment_ledger"
ON public.payment_ledger FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- shipments: buyer sees own, seller sees own, admin sees all
DROP POLICY IF EXISTS "buyer_view_own_shipments" ON public.shipments;
CREATE POLICY "buyer_view_own_shipments"
ON public.shipments FOR SELECT TO authenticated
USING (buyer_id = public.my_buyer_id());

DROP POLICY IF EXISTS "seller_view_own_shipments" ON public.shipments;
CREATE POLICY "seller_view_own_shipments"
ON public.shipments FOR SELECT TO authenticated
USING (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "seller_update_own_shipments" ON public.shipments;
CREATE POLICY "seller_update_own_shipments"
ON public.shipments FOR UPDATE TO authenticated
USING (seller_id = public.my_seller_id())
WITH CHECK (seller_id = public.my_seller_id());

DROP POLICY IF EXISTS "admin_full_access_shipments" ON public.shipments;
CREATE POLICY "admin_full_access_shipments"
ON public.shipments FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- shipment_tracking_events: buyer/seller can view events for their shipments
DROP POLICY IF EXISTS "buyer_view_tracking_events" ON public.shipment_tracking_events;
CREATE POLICY "buyer_view_tracking_events"
ON public.shipment_tracking_events FOR SELECT TO authenticated
USING (
  shipment_id IN (
    SELECT id FROM public.shipments WHERE buyer_id = public.my_buyer_id()
  )
);

DROP POLICY IF EXISTS "seller_view_tracking_events" ON public.shipment_tracking_events;
CREATE POLICY "seller_view_tracking_events"
ON public.shipment_tracking_events FOR SELECT TO authenticated
USING (
  shipment_id IN (
    SELECT id FROM public.shipments WHERE seller_id = public.my_seller_id()
  )
);

DROP POLICY IF EXISTS "admin_full_access_tracking_events" ON public.shipment_tracking_events;
CREATE POLICY "admin_full_access_tracking_events"
ON public.shipment_tracking_events FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 8. CONSTRAINT: NO COD ALLOWED
-- ============================================================
-- Enforce no COD at database level
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN DEFAULT false;

-- Partial index to enforce no COD (cod_enabled must always be false)
CREATE OR REPLACE FUNCTION public.enforce_no_cod()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cod_enabled = true THEN
    RAISE EXCEPTION 'Cash on Delivery is not permitted on FabricTrad. All payments must be made online.';
  END IF;
  IF NEW.payment_method = 'cod' THEN
    RAISE EXCEPTION 'COD payment method is not permitted. Use online payment only.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_cod_trigger ON public.orders;
CREATE TRIGGER enforce_no_cod_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_no_cod();
