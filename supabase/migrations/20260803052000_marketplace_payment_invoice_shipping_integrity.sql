-- Marketplace payment, invoice and shipment integrity.

ALTER TABLE public.catalog_order_requests
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_refunded numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.catalog_order_requests
  DROP CONSTRAINT IF EXISTS catalog_order_requests_payment_status_check,
  ADD CONSTRAINT catalog_order_requests_payment_status_check
    CHECK (payment_status IN ('unpaid','partial','paid','partially_refunded','refunded','failed')),
  DROP CONSTRAINT IF EXISTS catalog_order_requests_amount_paid_check,
  ADD CONSTRAINT catalog_order_requests_amount_paid_check CHECK (amount_paid >= 0),
  DROP CONSTRAINT IF EXISTS catalog_order_requests_amount_refunded_check,
  ADD CONSTRAINT catalog_order_requests_amount_refunded_check CHECK (amount_refunded >= 0);

ALTER TABLE public.bulk_orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_refunded numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.bulk_orders
  DROP CONSTRAINT IF EXISTS bulk_orders_payment_status_check,
  ADD CONSTRAINT bulk_orders_payment_status_check
    CHECK (payment_status IN ('unpaid','partial','paid','partially_refunded','refunded','failed')),
  DROP CONSTRAINT IF EXISTS bulk_orders_amount_paid_check,
  ADD CONSTRAINT bulk_orders_amount_paid_check CHECK (amount_paid >= 0),
  DROP CONSTRAINT IF EXISTS bulk_orders_amount_refunded_check,
  ADD CONSTRAINT bulk_orders_amount_refunded_check CHECK (amount_refunded >= 0);

DO $$
DECLARE payment_table text;
BEGIN
  FOREACH payment_table IN ARRAY ARRAY['catalog_order_payments','bulk_order_payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS captured_amount numeric(12,2)', payment_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0', payment_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS payment_method text', payment_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS razorpay_fee_actual numeric(12,2) NOT NULL DEFAULT 0', payment_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS razorpay_tax_actual numeric(12,2) NOT NULL DEFAULT 0', payment_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_webhook_event text', payment_table);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz', payment_table);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', payment_table, payment_table || '_status_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (status IN (''initiated'',''authorized'',''captured'',''failed'',''partially_refunded'',''refunded''))',
      payment_table,
      payment_table || '_status_check'
    );
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', payment_table, payment_table || '_refunded_amount_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (refunded_amount >= 0 AND refunded_amount <= amount)',
      payment_table,
      payment_table || '_refunded_amount_check'
    );
  END LOOP;
END $$;

-- Buyers must never be able to insert arbitrary legacy payment rows directly.
DROP POLICY IF EXISTS buyer_create_payments ON public.payments;

-- Protect bulk-order ownership, totals and state transitions from broad client updates.
CREATE OR REPLACE FUNCTION public.protect_bulk_order_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_seller_id uuid;
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
    OR NEW.gross_total IS DISTINCT FROM OLD.gross_total
    OR NEW.discount_total IS DISTINCT FROM OLD.discount_total
    OR NEW.gst_total IS DISTINCT FROM OLD.gst_total
    OR NEW.net_total IS DISTINCT FROM OLD.net_total
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
    OR NEW.amount_refunded IS DISTINCT FROM OLD.amount_refunded THEN
    RAISE EXCEPTION 'Bulk order ownership, totals and payment values cannot be changed directly';
  END IF;

  IF auth.uid() = OLD.buyer_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      AND NOT (OLD.status IN ('draft','quote_sent','confirmed') AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'Buyer is not allowed to set this bulk order status';
    END IF;
    IF OLD.amount_paid > 0 AND NEW.status = 'cancelled' THEN
      RAISE EXCEPTION 'A paid order must be refunded before cancellation';
    END IF;
    RETURN NEW;
  END IF;

  actor_seller_id := public.my_seller_id();
  IF actor_seller_id = OLD.seller_id AND public.can_current_user_sell() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      AND NOT (
        (OLD.status IN ('draft','quote_sent') AND NEW.status IN ('confirmed','cancelled'))
        OR (OLD.status = 'paid' AND NEW.status = 'shipped')
        OR (OLD.status = 'shipped' AND NEW.status = 'delivered')
      ) THEN
      RAISE EXCEPTION 'Seller is not allowed to set this bulk order status';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorised to update this bulk order';
END;
$$;

DROP TRIGGER IF EXISTS protect_bulk_order_state_trigger ON public.bulk_orders;
CREATE TRIGGER protect_bulk_order_state_trigger
BEFORE UPDATE ON public.bulk_orders
FOR EACH ROW EXECUTE FUNCTION public.protect_bulk_order_state();

-- Repair the seller shipment model used by bulk and catalogue orders.
ALTER TABLE public.seller_shipments
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bulk_order_id uuid REFERENCES public.bulk_orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS catalog_order_id uuid REFERENCES public.catalog_order_requests(id) ON DELETE RESTRICT;

UPDATE public.seller_shipments shipment
SET bulk_order_id = orders.id,
    buyer_id = orders.buyer_id
FROM public.bulk_orders orders
WHERE shipment.bulk_order_id IS NULL
  AND shipment.order_id ~* '^[0-9a-f-]{36}$'
  AND orders.id = shipment.order_id::uuid;

CREATE UNIQUE INDEX IF NOT EXISTS seller_shipments_bulk_order_unique
  ON public.seller_shipments(bulk_order_id) WHERE bulk_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seller_shipments_catalog_order_unique
  ON public.seller_shipments(catalog_order_id) WHERE catalog_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS seller_shipments_buyer_idx ON public.seller_shipments(buyer_id);

ALTER TABLE public.seller_shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read shipments by order" ON public.seller_shipments;
DROP POLICY IF EXISTS "Sellers manage own shipments" ON public.seller_shipments;
DROP POLICY IF EXISTS seller_shipments_buyer_read ON public.seller_shipments;
DROP POLICY IF EXISTS seller_shipments_seller_manage ON public.seller_shipments;
DROP POLICY IF EXISTS seller_shipments_admin_manage ON public.seller_shipments;

CREATE POLICY seller_shipments_buyer_read ON public.seller_shipments
FOR SELECT TO authenticated
USING (buyer_id = (SELECT auth.uid()));

CREATE POLICY seller_shipments_seller_manage ON public.seller_shipments
FOR ALL TO authenticated
USING (seller_id = public.my_seller_id() AND public.can_current_user_sell())
WITH CHECK (
  seller_id = public.my_seller_id()
  AND public.can_current_user_sell()
  AND buyer_id IS NOT NULL
  AND ((bulk_order_id IS NOT NULL)::int + (catalog_order_id IS NOT NULL)::int = 1)
);

CREATE POLICY seller_shipments_admin_manage ON public.seller_shipments
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Verified seller-uploaded billing documents become visible to the purchasing buyer.
ALTER TABLE public.seller_billing_documents
  ADD COLUMN IF NOT EXISTS catalog_order_id uuid REFERENCES public.catalog_order_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS irn text,
  ADD COLUMN IF NOT EXISTS acknowledgement_number text,
  ADD COLUMN IF NOT EXISTS acknowledgement_date timestamptz;

UPDATE public.seller_billing_documents document
SET buyer_user_id = orders.buyer_id
FROM public.bulk_orders orders
WHERE document.buyer_user_id IS NULL
  AND document.bulk_order_id = orders.id;

ALTER TABLE public.seller_billing_documents
  DROP CONSTRAINT IF EXISTS seller_billing_documents_status_check,
  ADD CONSTRAINT seller_billing_documents_status_check
    CHECK (status IN ('uploaded','verified','issued','rejected','void'));

DROP POLICY IF EXISTS seller_billing_documents_buyer_select ON public.seller_billing_documents;
CREATE POLICY seller_billing_documents_buyer_select ON public.seller_billing_documents
FOR SELECT TO authenticated
USING (
  buyer_user_id = (SELECT auth.uid())
  AND status IN ('verified','issued')
);

-- Immutable seller-issued GST invoice snapshots for direct catalogue orders.
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS e_invoice_applicable boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.seller_invoice_sequences (
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  financial_year text NOT NULL,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, financial_year)
);

CREATE TABLE IF NOT EXISTS public.seller_tax_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  catalog_order_id uuid NOT NULL REFERENCES public.catalog_order_requests(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  financial_year text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','void')),
  supplier jsonb NOT NULL,
  recipient jsonb NOT NULL,
  delivery_address jsonb NOT NULL,
  place_of_supply text,
  reverse_charge boolean NOT NULL DEFAULT false,
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) > 0),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  taxable_value numeric(12,2) NOT NULL CHECK (taxable_value >= 0),
  cgst_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  igst_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (igst_amount >= 0),
  cess_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (cess_amount >= 0),
  total_tax numeric(12,2) NOT NULL CHECK (total_tax >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_reference text NOT NULL,
  payment_captured_at timestamptz,
  e_invoice_applicable boolean NOT NULL DEFAULT false,
  irn text,
  acknowledgement_number text,
  acknowledgement_date timestamptz,
  signed_qr_data text,
  supplier_confirmation_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, invoice_number),
  UNIQUE (catalog_order_id)
);

CREATE INDEX IF NOT EXISTS seller_tax_invoices_buyer_idx
  ON public.seller_tax_invoices(buyer_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS seller_tax_invoices_seller_idx
  ON public.seller_tax_invoices(seller_id, issued_at DESC);

ALTER TABLE public.seller_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_tax_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_invoice_sequences_admin_only ON public.seller_invoice_sequences;
CREATE POLICY seller_invoice_sequences_admin_only ON public.seller_invoice_sequences
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS seller_tax_invoices_read ON public.seller_tax_invoices;
DROP POLICY IF EXISTS seller_tax_invoices_admin_manage ON public.seller_tax_invoices;
CREATE POLICY seller_tax_invoices_read ON public.seller_tax_invoices
FOR SELECT TO authenticated
USING (
  buyer_user_id = (SELECT auth.uid())
  OR seller_id = public.my_seller_id()
  OR public.is_admin()
);
CREATE POLICY seller_tax_invoices_admin_manage ON public.seller_tax_invoices
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.issue_catalog_tax_invoice(
  p_catalog_order_id uuid,
  p_reverse_charge boolean DEFAULT false,
  p_irn text DEFAULT NULL,
  p_acknowledgement_number text DEFAULT NULL,
  p_acknowledgement_date timestamptz DEFAULT NULL,
  p_signed_qr_data text DEFAULT NULL
)
RETURNS public.seller_tax_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_user_id uuid := auth.uid();
  actor_seller_id uuid := public.my_seller_id();
  seller_row public.seller_profiles%ROWTYPE;
  order_row public.catalog_order_requests%ROWTYPE;
  product_row public.seller_products%ROWTYPE;
  buyer_row public.user_profiles%ROWTYPE;
  seller_user_row public.user_profiles%ROWTYPE;
  payment_row public.catalog_order_payments%ROWTYPE;
  existing_invoice public.seller_tax_invoices%ROWTYPE;
  sequence_number integer;
  fy_start integer;
  financial_year text;
  generated_invoice_number text;
  supplier_payload jsonb;
  recipient_payload jsonb;
  delivery_payload jsonb;
  line_payload jsonb;
  invoice_row public.seller_tax_invoices%ROWTYPE;
BEGIN
  IF actor_user_id IS NULL OR actor_seller_id IS NULL OR NOT public.can_current_user_sell() THEN
    RAISE EXCEPTION 'Verified seller access is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing_invoice
  FROM public.seller_tax_invoices
  WHERE catalog_order_id = p_catalog_order_id;
  IF FOUND THEN
    IF existing_invoice.seller_id <> actor_seller_id THEN
      RAISE EXCEPTION 'Invoice does not belong to this seller' USING ERRCODE = '42501';
    END IF;
    RETURN existing_invoice;
  END IF;

  SELECT * INTO seller_row
  FROM public.seller_profiles
  WHERE id = actor_seller_id
  FOR UPDATE;

  IF NOT FOUND
    OR seller_row.is_active IS DISTINCT FROM true
    OR seller_row.gstin_verified IS DISTINCT FROM true
    OR seller_row.verification_status::text NOT IN ('approved','verified','active') THEN
    RAISE EXCEPTION 'An active GST-verified seller profile is required before issuing an invoice';
  END IF;

  SELECT * INTO order_row
  FROM public.catalog_order_requests
  WHERE id = p_catalog_order_id AND seller_id = actor_seller_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catalogue order not found'; END IF;
  IF order_row.status NOT IN ('paid','fulfilled') OR order_row.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'The order must be fully paid before a GST invoice is issued';
  END IF;

  SELECT * INTO payment_row
  FROM public.catalog_order_payments
  WHERE catalog_order_id = order_row.id AND status IN ('captured','partially_refunded','refunded')
  ORDER BY captured_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
  IF NOT FOUND OR payment_row.razorpay_payment_id IS NULL THEN
    RAISE EXCEPTION 'Captured payment evidence is missing for this order';
  END IF;

  SELECT * INTO product_row FROM public.seller_products WHERE id = order_row.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product snapshot source is unavailable'; END IF;
  IF nullif(trim(coalesce(product_row.hsn_code, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Add a valid HSN code to the product before issuing its GST invoice';
  END IF;

  SELECT * INTO buyer_row FROM public.user_profiles WHERE id = order_row.buyer_id;
  SELECT * INTO seller_user_row FROM public.user_profiles WHERE id = seller_row.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Seller account profile is unavailable'; END IF;

  IF seller_row.e_invoice_applicable
    AND (nullif(trim(coalesce(p_irn, '')), '') IS NULL OR nullif(trim(coalesce(p_signed_qr_data, '')), '') IS NULL) THEN
    RAISE EXCEPTION 'IRN and signed QR data are required for this e-invoice-enabled seller';
  END IF;

  fy_start := CASE WHEN EXTRACT(MONTH FROM now()) >= 4 THEN EXTRACT(YEAR FROM now())::integer ELSE EXTRACT(YEAR FROM now())::integer - 1 END;
  financial_year := right(fy_start::text, 2) || '-' || right((fy_start + 1)::text, 2);

  INSERT INTO public.seller_invoice_sequences (seller_id, financial_year, last_number)
  VALUES (actor_seller_id, financial_year, 1)
  ON CONFLICT (seller_id, financial_year)
  DO UPDATE SET last_number = public.seller_invoice_sequences.last_number + 1, updated_at = now()
  RETURNING last_number INTO sequence_number;

  generated_invoice_number := 'FT/' || financial_year || '/' || lpad(sequence_number::text, 6, '0');

  supplier_payload := jsonb_build_object(
    'legalName', seller_row.legal_business_name,
    'tradeName', coalesce(seller_row.display_name, seller_row.legal_business_name),
    'gstin', seller_row.gstin,
    'address', coalesce(seller_row.pickup_address, '{}'::jsonb),
    'email', seller_user_row.email,
    'phone', seller_user_row.phone
  );
  recipient_payload := jsonb_build_object(
    'name', buyer_row.full_name,
    'businessName', buyer_row.business_name,
    'gstin', buyer_row.gstin,
    'email', buyer_row.email,
    'phone', buyer_row.phone,
    'addressLine1', buyer_row.address_line1,
    'addressLine2', buyer_row.address_line2,
    'city', buyer_row.city,
    'state', buyer_row.state,
    'pincode', buyer_row.pincode
  );
  delivery_payload := jsonb_build_object(
    'addressLine1', buyer_row.address_line1,
    'addressLine2', buyer_row.address_line2,
    'city', buyer_row.city,
    'state', buyer_row.state,
    'pincode', buyer_row.pincode
  );
  line_payload := jsonb_build_array(jsonb_build_object(
    'description', product_row.name,
    'sku', product_row.sku,
    'hsnCode', product_row.hsn_code,
    'quantity', order_row.quantity,
    'unit', order_row.unit,
    'unitPrice', order_row.price_per_unit,
    'taxableValue', order_row.subtotal,
    'gstRate', order_row.gst_rate,
    'cgstAmount', order_row.cgst_amount,
    'sgstAmount', order_row.sgst_amount,
    'igstAmount', order_row.igst_amount,
    'cessAmount', 0,
    'lineTotal', order_row.total_amount
  ));

  INSERT INTO public.seller_tax_invoices (
    seller_id, buyer_user_id, catalog_order_id, invoice_number, financial_year,
    issued_by_user_id, supplier, recipient, delivery_address, place_of_supply,
    reverse_charge, lines, subtotal, taxable_value, cgst_amount, sgst_amount,
    igst_amount, total_tax, total_amount, payment_reference, payment_captured_at,
    e_invoice_applicable, irn, acknowledgement_number, acknowledgement_date,
    signed_qr_data
  ) VALUES (
    actor_seller_id, order_row.buyer_id, order_row.id, generated_invoice_number, financial_year,
    actor_user_id, supplier_payload, recipient_payload, delivery_payload,
    coalesce(order_row.place_of_supply_state, buyer_row.state), coalesce(p_reverse_charge, false),
    line_payload, order_row.subtotal, order_row.subtotal, order_row.cgst_amount,
    order_row.sgst_amount, order_row.igst_amount, order_row.gst_amount,
    order_row.total_amount, payment_row.razorpay_payment_id, payment_row.captured_at,
    seller_row.e_invoice_applicable, nullif(trim(p_irn), ''),
    nullif(trim(p_acknowledgement_number), ''), p_acknowledgement_date,
    nullif(trim(p_signed_qr_data), '')
  ) RETURNING * INTO invoice_row;

  RETURN invoice_row;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_catalog_tax_invoice(uuid, boolean, text, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_catalog_tax_invoice(uuid, boolean, text, text, timestamptz, text) TO authenticated;

-- Prevent unauthenticated account-enumeration through the identity conflict helper.
REVOKE EXECUTE ON FUNCTION public.check_identity_conflict(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_identity_conflict(text, text) TO authenticated;
