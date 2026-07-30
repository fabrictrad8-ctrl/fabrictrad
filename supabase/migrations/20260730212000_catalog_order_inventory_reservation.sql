-- Atomically accept/reject direct catalogue orders and keep stock correct.

CREATE OR REPLACE FUNCTION public.seller_decide_catalog_order(
  p_order_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS public.catalog_order_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_row public.catalog_order_requests%ROWTYPE;
  seller_profile_id uuid;
  available_stock numeric(12,2);
BEGIN
  seller_profile_id := public.my_seller_id();
  IF seller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Seller profile is required';
  END IF;
  IF p_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Unsupported order action';
  END IF;

  SELECT * INTO request_row
  FROM public.catalog_order_requests
  WHERE id = p_order_id
    AND seller_id = seller_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order request not found';
  END IF;
  IF request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending order requests can be decided';
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.catalog_order_requests
    SET status = 'rejected',
        notes = concat_ws(E'\n', NULLIF(notes, ''),
          'Seller rejection: ' || COALESCE(NULLIF(trim(p_reason), ''), 'Unable to fulfil this request.')),
        updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO request_row;
    RETURN request_row;
  END IF;

  IF request_row.variant_id IS NOT NULL THEN
    SELECT available_quantity INTO available_stock
    FROM public.seller_product_variants
    WHERE id = request_row.variant_id
      AND product_id = request_row.product_id
      AND seller_id = seller_profile_id
    FOR UPDATE;

    IF NOT FOUND OR available_stock < request_row.quantity THEN
      RAISE EXCEPTION 'Not enough stock is available for this variation';
    END IF;

    UPDATE public.seller_product_variants
    SET available_quantity = available_quantity - request_row.quantity,
        updated_at = now()
    WHERE id = request_row.variant_id;
  ELSE
    SELECT available_quantity INTO available_stock
    FROM public.seller_products
    WHERE id = request_row.product_id
      AND seller_id = seller_profile_id
    FOR UPDATE;

    IF NOT FOUND OR available_stock < request_row.quantity THEN
      RAISE EXCEPTION 'Not enough stock is available for this product';
    END IF;

    UPDATE public.seller_products
    SET available_quantity = available_quantity - request_row.quantity,
        updated_at = now()
    WHERE id = request_row.product_id;
  END IF;

  UPDATE public.catalog_order_requests
  SET status = 'accepted',
      payment_due_at = now() + interval '48 hours',
      notes = concat_ws(E'\n', NULLIF(notes, ''),
        CASE WHEN NULLIF(trim(p_reason), '') IS NULL
          THEN 'Seller accepted the requested quantity.'
          ELSE 'Seller acceptance note: ' || trim(p_reason)
        END),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO request_row;

  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_decide_catalog_order(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_decide_catalog_order(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_catalog_order_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
    IF OLD.variant_id IS NOT NULL THEN
      UPDATE public.seller_product_variants
      SET available_quantity = available_quantity + OLD.quantity,
          updated_at = now()
      WHERE id = OLD.variant_id
        AND product_id = OLD.product_id
        AND seller_id = OLD.seller_id;
    ELSE
      UPDATE public.seller_products
      SET available_quantity = available_quantity + OLD.quantity,
          updated_at = now()
      WHERE id = OLD.product_id
        AND seller_id = OLD.seller_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restore_catalog_order_stock_on_cancel_trigger ON public.catalog_order_requests;
CREATE TRIGGER restore_catalog_order_stock_on_cancel_trigger
  AFTER UPDATE OF status ON public.catalog_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.restore_catalog_order_stock_on_cancel();
