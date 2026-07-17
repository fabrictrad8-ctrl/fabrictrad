-- Migration: Dispute & Messaging Platform + Policy Enforcement
-- Timestamp: 20260717220000

-- ============================================================
-- 1. DISPUTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  buyer_id UUID REFERENCES public.buyer_profiles(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.seller_profiles(id) ON DELETE SET NULL,
  product_name TEXT,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('exchange_request', 'damage_claim', 'quality_issue', 'general_query')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'escalated', 'closed')),
  description TEXT NOT NULL,
  has_unboxing_video BOOLEAN NOT NULL DEFAULT FALSE,
  unboxing_video_url TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. DISPUTE MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('buyer', 'seller', 'admin')),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  message_text TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('image', 'document', 'video', NULL)),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. DRAPE USAGE TRACKING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drape_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.buyer_profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  drape_count INTEGER NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, usage_date)
);

-- ============================================================
-- 4. PLATFORM POLICIES TABLE (for admin-configurable policies)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT UNIQUE NOT NULL,
  policy_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default policies
INSERT INTO public.platform_policies (policy_key, policy_value, description)
VALUES
  ('cod_enabled', 'false', 'Cash on Delivery — always false, no COD allowed'),
  ('returns_allowed', 'false', 'Returns are not allowed on this platform'),
  ('exchange_allowed', 'true', 'Exchanges allowed only for damage with unboxing video'),
  ('exchange_requires_unboxing_video', 'true', 'Unboxing video mandatory for exchange/damage claims'),
  ('drape_free_quota', '2', 'Number of free drapes per user account'),
  ('drape_paid_rate_inr', '10', 'Charge in INR per day for drapes beyond free quota')
ON CONFLICT (policy_key) DO NOTHING;

-- ============================================================
-- 5. ENFORCE NO COD TRIGGER (additional safety on disputes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_exchange_policy()
RETURNS TRIGGER AS $$
BEGIN
  -- Exchange/damage claims MUST have unboxing video
  IF NEW.dispute_type IN ('exchange_request', 'damage_claim') AND NEW.has_unboxing_video = FALSE THEN
    RAISE EXCEPTION 'Exchange and damage claims require an unboxing video as proof. Please upload your unboxing video.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_exchange_policy_trigger ON public.disputes;
CREATE TRIGGER enforce_exchange_policy_trigger
  BEFORE INSERT OR UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_exchange_policy();

-- ============================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disputes_updated_at ON public.disputes;
CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS drape_usage_updated_at ON public.drape_usage;
CREATE TRIGGER drape_usage_updated_at
  BEFORE UPDATE ON public.drape_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id ON public.disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_id ON public.disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON public.dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON public.dispute_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_drape_usage_buyer_date ON public.drape_usage(buyer_id, usage_date);

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drape_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;

-- Disputes: buyers see their own, sellers see disputes for their orders
DROP POLICY IF EXISTS "buyers_own_disputes" ON public.disputes;
CREATE POLICY "buyers_own_disputes" ON public.disputes
  FOR ALL USING (
    disputes.buyer_id IN (
      SELECT bp.id FROM public.buyer_profiles bp WHERE bp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sellers_related_disputes" ON public.disputes;
CREATE POLICY "sellers_related_disputes" ON public.disputes
  FOR ALL USING (
    disputes.seller_id IN (
      SELECT sp.id FROM public.seller_profiles sp WHERE sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins_all_disputes" ON public.disputes;
CREATE POLICY "admins_all_disputes" ON public.disputes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
  );

-- Dispute messages: visible to dispute participants
DROP POLICY IF EXISTS "dispute_message_access" ON public.dispute_messages;
CREATE POLICY "dispute_message_access" ON public.dispute_messages
  FOR ALL USING (
    dispute_messages.dispute_id IN (
      SELECT d.id FROM public.disputes d WHERE
        d.buyer_id IN (SELECT bp.id FROM public.buyer_profiles bp WHERE bp.user_id = auth.uid())
        OR d.seller_id IN (SELECT sp.id FROM public.seller_profiles sp WHERE sp.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
        )
    )
  );

-- Drape usage: buyers see own usage
DROP POLICY IF EXISTS "buyers_own_drape_usage" ON public.drape_usage;
CREATE POLICY "buyers_own_drape_usage" ON public.drape_usage
  FOR ALL USING (
    drape_usage.buyer_id IN (
      SELECT bp.id FROM public.buyer_profiles bp WHERE bp.user_id = auth.uid()
    )
  );

-- Platform policies: public read, admin write
DROP POLICY IF EXISTS "platform_policies_public_read" ON public.platform_policies;
CREATE POLICY "platform_policies_public_read" ON public.platform_policies
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "platform_policies_admin_write" ON public.platform_policies;
CREATE POLICY "platform_policies_admin_write" ON public.platform_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
  );
