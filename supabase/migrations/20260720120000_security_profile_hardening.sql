-- FabricTrad security, payment and API hardening.
-- Apply after all 20260718 migrations.

-- ---------------------------------------------------------------------------
-- Trusted roles and profile protection
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' IN ('super_admin', 'admin_staff')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    NULLIF((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()), ''),
    (SELECT role::text FROM public.user_profiles WHERE id = auth.uid()),
    'buyer'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requested_role public.user_role;
  normalized_phone text;
BEGIN
  -- Public signup may request only buyer or seller. Admin roles are assigned
  -- through auth.users.raw_app_meta_data by a trusted service operation.
  requested_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'seller' THEN 'seller'::public.user_role
    ELSE 'buyer'::public.user_role
  END;

  normalized_phone := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'),
    ''
  );

  IF normalized_phone IS NOT NULL
     AND (length(normalized_phone) <> 10 OR normalized_phone !~ '^[6-9]') THEN
    RAISE EXCEPTION 'A valid 10 digit Indian phone number is required';
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, phone, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    normalized_phone,
    requested_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.user_profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

-- Synchronize trusted app-metadata admins, then remove any profile-level admin
-- role that is not backed by trusted app metadata.
UPDATE public.user_profiles AS profile
SET role = (auth_user.raw_app_meta_data->>'role')::public.user_role,
    updated_at = CURRENT_TIMESTAMP
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND auth_user.raw_app_meta_data->>'role' IN ('super_admin', 'admin_staff');

UPDATE public.user_profiles AS profile
SET role = 'buyer'::public.user_role,
    updated_at = CURRENT_TIMESTAMP
WHERE profile.role IN ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = profile.id
      AND auth_user.raw_app_meta_data->>'role' IN ('super_admin', 'admin_staff')
  );

CREATE OR REPLACE FUNCTION public.protect_user_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Google OAuth creates the auth user before the callback knows whether the
    -- person selected seller onboarding. Permit only this short-lived, clean
    -- buyer-to-seller transition; admin roles remain impossible from clients.
    IF OLD.role = 'buyer'::public.user_role
       AND NEW.role = 'seller'::public.user_role
       AND OLD.created_at > now() - interval '15 minutes'
       AND NOT EXISTS (SELECT 1 FROM public.buyer_profiles WHERE user_id = OLD.id)
       AND NOT EXISTS (SELECT 1 FROM public.seller_profiles WHERE user_id = OLD.id) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Account roles cannot be changed from the client';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Verified identity fields cannot be changed from the client';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_profile_role_trigger ON public.user_profiles;
CREATE TRIGGER protect_user_profile_role_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_role();

DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_check_phone_uniqueness" ON public.user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

CREATE POLICY "users_read_own_profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Prevent buyers and sellers from self-approving verification or payout fields.
CREATE OR REPLACE FUNCTION public.protect_buyer_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> auth.uid() OR NEW.gstin_verified = true OR NEW.is_active = false THEN
      RAISE EXCEPTION 'Buyer verification fields are managed by FabricTrad';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.gstin_verified IS DISTINCT FROM OLD.gstin_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Buyer verification fields are managed by FabricTrad';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_buyer_profile_verification_trigger ON public.buyer_profiles;
CREATE TRIGGER protect_buyer_profile_verification_trigger
  BEFORE INSERT OR UPDATE ON public.buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_buyer_profile_verification();

CREATE OR REPLACE FUNCTION public.protect_seller_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id <> auth.uid()
       OR NEW.gstin_verified = true
       OR NEW.verification_status <> 'registration_started'::public.seller_status
       OR NEW.razorpay_linked_account_id IS NOT NULL
       OR NEW.settlement_eligible = true
       OR NEW.is_active = false THEN
      RAISE EXCEPTION 'Seller verification and payout fields are managed by FabricTrad';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.gstin_verified IS DISTINCT FROM OLD.gstin_verified
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.razorpay_linked_account_id IS DISTINCT FROM OLD.razorpay_linked_account_id
     OR NEW.settlement_eligible IS DISTINCT FROM OLD.settlement_eligible
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Seller verification and payout fields are managed by FabricTrad';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_seller_profile_verification_trigger ON public.seller_profiles;
CREATE TRIGGER protect_seller_profile_verification_trigger
  BEFORE INSERT OR UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_profile_verification();

CREATE OR REPLACE FUNCTION public.protect_seller_bank_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.seller_id IS DISTINCT FROM OLD.seller_id
    OR NEW.razorpay_fund_account_id IS DISTINCT FROM OLD.razorpay_fund_account_id
    OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
    OR (
      OLD.is_verified = true AND (
        NEW.account_holder_name IS DISTINCT FROM OLD.account_holder_name
        OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
        OR NEW.account_number_masked IS DISTINCT FROM OLD.account_number_masked
        OR NEW.ifsc_code IS DISTINCT FROM OLD.ifsc_code
        OR NEW.account_type IS DISTINCT FROM OLD.account_type
      )
    )
  ) THEN
    RAISE EXCEPTION 'Bank verification fields are managed by FabricTrad';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.razorpay_fund_account_id IS NOT NULL OR NEW.is_verified = true) THEN
    RAISE EXCEPTION 'Bank verification fields are managed by FabricTrad';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_seller_bank_verification_trigger ON public.seller_bank_profiles;
CREATE TRIGGER protect_seller_bank_verification_trigger
  BEFORE INSERT OR UPDATE ON public.seller_bank_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_bank_verification();

DROP POLICY IF EXISTS "super_admin_access_bank_profiles" ON public.seller_bank_profiles;
CREATE POLICY "super_admin_access_bank_profiles"
  ON public.seller_bank_profiles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_app_meta_data->>'role' = 'super_admin'
    )
  );

-- Expose only directory-safe seller data to marketplace visitors.
DROP POLICY IF EXISTS "public_read_seller_profiles" ON public.seller_profiles;
DROP VIEW IF EXISTS public.seller_directory;
CREATE VIEW public.seller_directory
WITH (security_barrier = true)
AS
SELECT
  id,
  seller_ref,
  display_name,
  legal_business_name,
  verification_status,
  is_active
FROM public.seller_profiles
WHERE is_active = true
  AND verification_status = 'verified'::public.seller_status;

GRANT SELECT ON public.seller_directory TO anon, authenticated;

-- Payment records are server-owned. A buyer may read their own payment but may
-- not fabricate or update one from the browser.
DROP POLICY IF EXISTS "buyer_create_payments" ON public.payments;

-- Protect the original orders table as well as the newer bulk-order flow.
CREATE OR REPLACE FUNCTION public.protect_core_order_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_seller_id uuid;
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.gst_amount IS DISTINCT FROM OLD.gst_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.shipping_charge IS DISTINCT FROM OLD.shipping_charge
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.cod_enabled IS DISTINCT FROM OLD.cod_enabled THEN
    RAISE EXCEPTION 'Order ownership and financial fields are immutable';
  END IF;

  IF OLD.buyer_id = public.my_buyer_id() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (NEW.status = 'cancelled'::public.order_status
                AND OLD.status IN (
                  'pending_seller_confirmation'::public.order_status,
                  'seller_accepted'::public.order_status,
                  'seller_rejected'::public.order_status,
                  'counter_offered'::public.order_status,
                  'awaiting_payment'::public.order_status
                )) THEN
      RAISE EXCEPTION 'Buyer is not allowed to set this order status';
    END IF;
    RETURN NEW;
  END IF;

  actor_seller_id := public.my_seller_id();
  IF actor_seller_id = OLD.seller_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'pending_seller_confirmation'::public.order_status
          AND NEW.status IN (
            'seller_accepted'::public.order_status,
            'seller_rejected'::public.order_status,
            'counter_offered'::public.order_status
          ))
         OR (OLD.status = 'paid'::public.order_status
             AND NEW.status IN ('processing'::public.order_status, 'ready_for_pickup'::public.order_status))
         OR (OLD.status = 'processing'::public.order_status
             AND NEW.status = 'ready_for_pickup'::public.order_status)
         OR (OLD.status = 'ready_for_pickup'::public.order_status
             AND NEW.status = 'pickup_scheduled'::public.order_status)
       ) THEN
      RAISE EXCEPTION 'Seller is not allowed to set this order status';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this order';
END;
$$;
DROP TRIGGER IF EXISTS protect_core_order_state_trigger ON public.orders;
CREATE TRIGGER protect_core_order_state_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_core_order_state();
