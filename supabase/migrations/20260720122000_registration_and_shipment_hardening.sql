-- ---------------------------------------------------------------------------
-- Secure registrations and shipment visibility
-- ---------------------------------------------------------------------------
ALTER TABLE public.seller_registrations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.seller_registrations AS registration
SET user_id = auth_user.id
FROM auth.users AS auth_user
WHERE registration.user_id IS NULL
  AND lower(registration.email) = lower(auth_user.email);

CREATE OR REPLACE FUNCTION public.set_seller_registration_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_seller_registration_user_id_trigger ON public.seller_registrations;
CREATE TRIGGER set_seller_registration_user_id_trigger
  BEFORE INSERT ON public.seller_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_seller_registration_user_id();

DROP POLICY IF EXISTS seller_own_or_admin ON public.seller_registrations;
CREATE POLICY "seller_owns_registration"
  ON public.seller_registrations FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_manages_registrations"
  ON public.seller_registrations FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.seller_registration_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_owns_registration_documents"
  ON public.seller_registration_documents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_registrations
      WHERE id = registration_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_registrations
      WHERE id = registration_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "admin_manages_registration_documents"
  ON public.seller_registration_documents FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_seller_registration_review()
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
       OR NEW.bank_verified = true
       OR NEW.razorpay_linked_account_id IS NOT NULL
       OR NEW.registration_status <> 'pending'
       OR NEW.rejection_reason IS NOT NULL
       OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Registration review fields are managed by FabricTrad';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.gstin_verified IS DISTINCT FROM OLD.gstin_verified
     OR NEW.gstin_verified_at IS DISTINCT FROM OLD.gstin_verified_at
     OR NEW.bank_verified IS DISTINCT FROM OLD.bank_verified
     OR NEW.bank_verified_at IS DISTINCT FROM OLD.bank_verified_at
     OR NEW.razorpay_linked_account_id IS DISTINCT FROM OLD.razorpay_linked_account_id
     OR NEW.registration_status IS DISTINCT FROM OLD.registration_status
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Registration review fields are managed by FabricTrad';
  END IF;

  IF OLD.bank_verified = true AND (
    NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    OR NEW.bank_ifsc IS DISTINCT FROM OLD.bank_ifsc
    OR NEW.bank_account_name IS DISTINCT FROM OLD.bank_account_name
    OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
  ) THEN
    RAISE EXCEPTION 'Verified bank details cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_seller_registration_review_trigger ON public.seller_registrations;
CREATE TRIGGER protect_seller_registration_review_trigger
  BEFORE INSERT OR UPDATE ON public.seller_registrations
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_registration_review();

CREATE OR REPLACE FUNCTION public.protect_registration_document_review()
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
    IF NEW.upload_status <> 'uploaded'
       OR NEW.rejection_reason IS NOT NULL
       OR NEW.reviewed_by IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Document review fields are managed by FabricTrad';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.registration_id IS DISTINCT FROM OLD.registration_id
     OR NEW.upload_status IS DISTINCT FROM OLD.upload_status
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'Document review fields are managed by FabricTrad';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_registration_document_review_trigger ON public.seller_registration_documents;
CREATE TRIGGER protect_registration_document_review_trigger
  BEFORE INSERT OR UPDATE ON public.seller_registration_documents
  FOR EACH ROW EXECUTE FUNCTION public.protect_registration_document_review();

ALTER TABLE public.seller_shipments
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

WITH duplicate_shipments AS (
  SELECT id, row_number() OVER (PARTITION BY order_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn
  FROM public.seller_shipments
)
DELETE FROM public.seller_shipments
WHERE id IN (SELECT id FROM duplicate_shipments WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_shipments_order_id_unique
  ON public.seller_shipments(order_id);

UPDATE public.seller_shipments AS shipment
SET buyer_id = bulk_order.buyer_id
FROM public.bulk_orders AS bulk_order
WHERE shipment.buyer_id IS NULL
  AND shipment.order_id = bulk_order.id::text;

DROP POLICY IF EXISTS "Public read shipments by order" ON public.seller_shipments;
CREATE POLICY "buyers_read_own_seller_shipments"
  ON public.seller_shipments FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());
CREATE POLICY "admins_manage_seller_shipments"
  ON public.seller_shipments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
