-- ---------------------------------------------------------------------------
-- Bulk-order authorization and state protection
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Buyers manage own bulk orders" ON public.bulk_orders;

CREATE POLICY "buyers_read_own_bulk_orders"
  ON public.bulk_orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY "buyers_create_draft_bulk_orders"
  ON public.bulk_orders FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND status = 'draft');

CREATE POLICY "buyers_update_own_bulk_orders"
  ON public.bulk_orders FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "sellers_read_assigned_bulk_orders"
  ON public.bulk_orders FOR SELECT TO authenticated
  USING (seller_id = public.my_seller_id());

CREATE POLICY "sellers_update_assigned_bulk_orders"
  ON public.bulk_orders FOR UPDATE TO authenticated
  USING (seller_id = public.my_seller_id())
  WITH CHECK (seller_id = public.my_seller_id());

CREATE POLICY "admins_manage_bulk_orders"
  ON public.bulk_orders FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_bulk_order_state()
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
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'Order ownership cannot be changed';
  END IF;

  IF auth.uid() = OLD.buyer_id THEN
    IF OLD.status <> 'draft' AND (
      NEW.gross_total IS DISTINCT FROM OLD.gross_total
      OR NEW.discount_total IS DISTINCT FROM OLD.discount_total
      OR NEW.gst_total IS DISTINCT FROM OLD.gst_total
      OR NEW.net_total IS DISTINCT FROM OLD.net_total
    ) THEN
      RAISE EXCEPTION 'Confirmed order totals cannot be changed';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'draft' AND NEW.status IN ('quote_sent', 'cancelled'))
         OR (OLD.status IN ('quote_sent', 'confirmed') AND NEW.status = 'cancelled')
       ) THEN
      RAISE EXCEPTION 'Buyer is not allowed to set this order status';
    END IF;

    RETURN NEW;
  END IF;

  actor_seller_id := public.my_seller_id();
  IF actor_seller_id = OLD.seller_id THEN
    IF NEW.gross_total IS DISTINCT FROM OLD.gross_total
       OR NEW.discount_total IS DISTINCT FROM OLD.discount_total
       OR NEW.gst_total IS DISTINCT FROM OLD.gst_total
       OR NEW.net_total IS DISTINCT FROM OLD.net_total THEN
      RAISE EXCEPTION 'Seller cannot modify buyer-approved totals';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'quote_sent' AND NEW.status IN ('confirmed', 'cancelled'))
         OR (OLD.status = 'paid' AND NEW.status = 'shipped')
         OR (OLD.status = 'shipped' AND NEW.status = 'delivered')
       ) THEN
      RAISE EXCEPTION 'Seller is not allowed to set this order status';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this order';
END;
$$;

DROP TRIGGER IF EXISTS protect_bulk_order_state_trigger ON public.bulk_orders;
CREATE TRIGGER protect_bulk_order_state_trigger
  BEFORE UPDATE ON public.bulk_orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_bulk_order_state();

DROP POLICY IF EXISTS "Bulk order items access" ON public.bulk_order_items;

CREATE POLICY "buyers_read_own_bulk_order_items"
  ON public.bulk_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_orders
      WHERE id = bulk_order_id AND buyer_id = auth.uid()
    )
  );

CREATE POLICY "buyers_manage_draft_bulk_order_items"
  ON public.bulk_order_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_orders
      WHERE id = bulk_order_id AND buyer_id = auth.uid() AND status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bulk_orders
      WHERE id = bulk_order_id AND buyer_id = auth.uid() AND status = 'draft'
    )
  );

CREATE POLICY "sellers_read_assigned_bulk_order_items"
  ON public.bulk_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bulk_orders
      WHERE id = bulk_order_id AND seller_id = public.my_seller_id()
    )
  );

CREATE POLICY "admins_manage_bulk_order_items"
  ON public.bulk_order_items FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
