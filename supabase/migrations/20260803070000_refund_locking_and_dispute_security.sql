-- Serialize refund requests and prevent marketplace participants from rewriting dispute outcomes.

CREATE OR REPLACE FUNCTION public.begin_marketplace_refund(
  p_order_kind text,
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_request_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment_table text;
  payment_row record;
  refundable numeric(12,2);
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;
  IF p_order_kind NOT IN ('catalog','bulk') THEN
    RAISE EXCEPTION 'Unsupported marketplace order kind';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'Refund amount must be at least INR 1.00';
  END IF;
  IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A refund reason is required';
  END IF;
  IF nullif(trim(coalesce(p_request_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A refund request key is required';
  END IF;

  payment_table := CASE WHEN p_order_kind = 'catalog'
    THEN 'catalog_order_payments'
    ELSE 'bulk_order_payments'
  END;

  EXECUTE format(
    'SELECT id, razorpay_payment_id, amount, refunded_amount, refund_requested_amount, refund_status, status, currency
       FROM public.%I WHERE id = $1 FOR UPDATE',
    payment_table
  ) INTO payment_row USING p_payment_id;

  IF payment_row.id IS NULL THEN RAISE EXCEPTION 'Payment record not found'; END IF;
  IF payment_row.razorpay_payment_id IS NULL THEN
    RAISE EXCEPTION 'Captured Razorpay payment reference is missing';
  END IF;
  IF payment_row.status NOT IN ('captured','partially_refunded') THEN
    RAISE EXCEPTION 'Only captured payments can be refunded';
  END IF;
  IF payment_row.currency <> 'INR' THEN
    RAISE EXCEPTION 'Only INR marketplace refunds are supported';
  END IF;
  IF payment_row.refund_status = 'requested' THEN
    IF payment_row.last_refund_request_id = p_request_key
      AND payment_row.refund_requested_amount = round(p_amount, 2) THEN
      RETURN jsonb_build_object(
        'paymentId', payment_row.id,
        'razorpayPaymentId', payment_row.razorpay_payment_id,
        'amount', payment_row.refund_requested_amount,
        'currency', payment_row.currency,
        'requestKey', p_request_key,
        'reused', true
      );
    END IF;
    RAISE EXCEPTION 'A refund request is already being processed for this payment';
  END IF;

  refundable := round(payment_row.amount - payment_row.refunded_amount, 2);
  IF refundable < 1 THEN RAISE EXCEPTION 'Payment has already been fully refunded'; END IF;
  IF round(p_amount, 2) > refundable THEN
    RAISE EXCEPTION 'Refund amount exceeds the captured refundable balance';
  END IF;

  EXECUTE format(
    'UPDATE public.%I
        SET refund_requested_amount = $1,
            refund_status = ''requested'',
            last_refund_request_id = $2,
            refund_reason = $3,
            updated_at = now()
      WHERE id = $4',
    payment_table
  ) USING round(p_amount, 2), p_request_key, left(trim(p_reason), 1000), p_payment_id;

  RETURN jsonb_build_object(
    'paymentId', payment_row.id,
    'razorpayPaymentId', payment_row.razorpay_payment_id,
    'amount', round(p_amount, 2),
    'currency', payment_row.currency,
    'requestKey', p_request_key,
    'reused', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_marketplace_refund_request(
  p_order_kind text,
  p_payment_id uuid,
  p_request_key text,
  p_refund_id text,
  p_outcome text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE payment_table text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required' USING ERRCODE = '42501';
  END IF;
  IF p_order_kind NOT IN ('catalog','bulk') THEN
    RAISE EXCEPTION 'Unsupported marketplace order kind';
  END IF;
  IF p_outcome NOT IN ('requested','processed','failed') THEN
    RAISE EXCEPTION 'Unsupported refund outcome';
  END IF;

  payment_table := CASE WHEN p_order_kind = 'catalog'
    THEN 'catalog_order_payments'
    ELSE 'bulk_order_payments'
  END;

  EXECUTE format(
    'UPDATE public.%I
        SET refund_status = $1,
            last_refund_request_id = coalesce($2, last_refund_request_id),
            failure_reason = CASE WHEN $1 = ''failed'' THEN left(coalesce($3, ''Refund request failed''), 1000) ELSE failure_reason END,
            refund_requested_amount = CASE WHEN $1 = ''failed'' THEN 0 ELSE refund_requested_amount END,
            updated_at = now()
      WHERE id = $4 AND last_refund_request_id = $5',
    payment_table
  ) USING p_outcome, p_refund_id, p_error, p_payment_id, p_request_key;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_marketplace_refund(text, uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_marketplace_refund_request(text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_marketplace_refund(text, uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_marketplace_refund_request(text, uuid, text, text, text, text) TO service_role;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bulk_order_id uuid REFERENCES public.bulk_orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS catalog_order_id uuid REFERENCES public.catalog_order_requests(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS requested_refund_amount numeric(12,2) CHECK (requested_refund_amount IS NULL OR requested_refund_amount >= 0);

UPDATE public.disputes dispute
SET buyer_user_id = buyer.user_id
FROM public.buyer_profiles buyer
WHERE dispute.buyer_user_id IS NULL AND dispute.buyer_id = buyer.id;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_all_disputes ON public.disputes;
DROP POLICY IF EXISTS buyers_own_disputes ON public.disputes;
DROP POLICY IF EXISTS sellers_related_disputes ON public.disputes;
DROP POLICY IF EXISTS dispute_message_access ON public.dispute_messages;

DROP POLICY IF EXISTS disputes_participant_read ON public.disputes;
DROP POLICY IF EXISTS disputes_buyer_create ON public.disputes;
DROP POLICY IF EXISTS disputes_admin_manage ON public.disputes;
DROP POLICY IF EXISTS dispute_messages_participant_read ON public.dispute_messages;
DROP POLICY IF EXISTS dispute_messages_participant_create ON public.dispute_messages;
DROP POLICY IF EXISTS dispute_messages_admin_manage ON public.dispute_messages;

CREATE POLICY disputes_participant_read ON public.disputes
FOR SELECT TO authenticated
USING (
  buyer_user_id = (SELECT auth.uid())
  OR buyer_id IN (
    SELECT id FROM public.buyer_profiles WHERE user_id = (SELECT auth.uid())
  )
  OR seller_id = public.my_seller_id()
  OR public.is_admin()
);

CREATE POLICY disputes_buyer_create ON public.disputes
FOR INSERT TO authenticated
WITH CHECK (
  buyer_user_id = (SELECT auth.uid())
  AND status = 'open'
  AND resolution_notes IS NULL
  AND resolved_at IS NULL
  AND (
    (bulk_order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bulk_orders orders
      WHERE orders.id = bulk_order_id AND orders.buyer_id = (SELECT auth.uid())
    ))
    OR
    (catalog_order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.catalog_order_requests orders
      WHERE orders.id = catalog_order_id AND orders.buyer_id = (SELECT auth.uid())
    ))
  )
);

CREATE POLICY disputes_admin_manage ON public.disputes
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY dispute_messages_participant_read ON public.dispute_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes dispute
    WHERE dispute.id = dispute_id
      AND (
        dispute.buyer_user_id = (SELECT auth.uid())
        OR dispute.buyer_id IN (
          SELECT id FROM public.buyer_profiles WHERE user_id = (SELECT auth.uid())
        )
        OR dispute.seller_id = public.my_seller_id()
        OR public.is_admin()
      )
  )
);

CREATE POLICY dispute_messages_participant_create ON public.dispute_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND sender_type IN ('buyer','seller')
  AND EXISTS (
    SELECT 1 FROM public.disputes dispute
    WHERE dispute.id = dispute_id
      AND dispute.status IN ('open','under_review','escalated')
      AND (
        (sender_type = 'buyer' AND (
          dispute.buyer_user_id = (SELECT auth.uid())
          OR dispute.buyer_id IN (
            SELECT id FROM public.buyer_profiles WHERE user_id = (SELECT auth.uid())
          )
        ))
        OR (sender_type = 'seller' AND dispute.seller_id = public.my_seller_id())
      )
  )
);

CREATE POLICY dispute_messages_admin_manage ON public.dispute_messages
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
