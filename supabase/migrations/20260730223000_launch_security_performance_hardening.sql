-- FabricTrad launch hardening.
-- Keep production security grants and high-value FK indexes reproducible from migrations.

-- Views must enforce the querying user's RLS context.
ALTER VIEW public.seller_rating_aggregates SET (security_invoker = true);

-- Pin search paths for legacy functions referenced by RLS and triggers.
ALTER FUNCTION public.get_my_role() SET search_path = '';
ALTER FUNCTION public.is_admin() SET search_path = '';
ALTER FUNCTION public.is_seller() SET search_path = '';
ALTER FUNCTION public.enforce_no_cod() SET search_path = '';
ALTER FUNCTION public.enforce_exchange_policy() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.update_seller_review_timestamp() SET search_path = '';

-- Intentional authenticated helpers and RPCs: never expose them to anonymous callers.
REVOKE ALL ON FUNCTION public.can_current_user_buy() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_current_user_sell() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_buyer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_seller_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_seller() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_seller_access(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_seller_application_documents_uploaded() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seller_decide_catalog_order(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_current_user_buy() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_current_user_sell() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_buyer_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_seller_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_seller() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_seller_access(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_seller_application_documents_uploaded() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seller_decide_catalog_order(uuid, text, text) TO authenticated, service_role;

-- Trigger-only and internal maintenance functions must not be callable through PostgREST.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_catalog_order_request_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_user_profile_capabilities() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_catalog_order_stock_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_product_variant_rollup(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_product_variant_rollup_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_no_cod() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_exchange_policy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_seller_review_timestamp() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_catalog_order_request_state() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_user_profile_capabilities() TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_catalog_order_stock_on_cancel() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_variant_rollup(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_variant_rollup_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_no_cod() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_exchange_policy() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_seller_review_timestamp() TO service_role;

-- Public buckets already serve public object URLs; broad SELECT policies unnecessarily expose listings.
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS seller_product_media_public_read ON storage.objects;

-- Avoid per-row re-evaluation in the newest high-traffic policies.
DROP POLICY IF EXISTS account_verifications_read_own ON public.account_verifications;
CREATE POLICY account_verifications_read_own ON public.account_verifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS account_verifications_submit_own ON public.account_verifications;
CREATE POLICY account_verifications_submit_own ON public.account_verifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = (SELECT auth.uid()) AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS account_verifications_update_pending_own ON public.account_verifications;
CREATE POLICY account_verifications_update_pending_own ON public.account_verifications
  FOR UPDATE TO authenticated
  USING ((user_id = (SELECT auth.uid()) AND status = 'pending') OR (SELECT public.is_admin()))
  WITH CHECK (
    (user_id = (SELECT auth.uid()) AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS account_verifications_admin_manage ON public.account_verifications;
DROP POLICY IF EXISTS account_verifications_admin_delete ON public.account_verifications;
CREATE POLICY account_verifications_admin_delete ON public.account_verifications
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS buyers_read_own_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_read_own_catalog_order_requests ON public.catalog_order_requests
  FOR SELECT TO authenticated
  USING (buyer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS buyers_cancel_catalog_order_requests ON public.catalog_order_requests;
CREATE POLICY buyers_cancel_catalog_order_requests ON public.catalog_order_requests
  FOR UPDATE TO authenticated
  USING (buyer_id = (SELECT auth.uid()) AND status IN ('pending', 'accepted'))
  WITH CHECK (buyer_id = (SELECT auth.uid()) AND status = 'cancelled');

-- Cover launch-critical foreign keys used by orders, media, chat, settlement and admin review paths.
CREATE INDEX IF NOT EXISTS idx_account_verifications_reviewed_by
  ON public.account_verifications(reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bulk_order_items_bulk_order_id
  ON public.bulk_order_items(bulk_order_id);
CREATE INDEX IF NOT EXISTS idx_bulk_order_payments_bulk_order_id
  ON public.bulk_order_payments(bulk_order_id);
CREATE INDEX IF NOT EXISTS idx_bulk_orders_buyer_id
  ON public.bulk_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bulk_orders_seller_id
  ON public.bulk_orders(seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_order_requests_product_id
  ON public.catalog_order_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_order_requests_variant_id
  ON public.catalog_order_requests(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
  ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved_by
  ON public.error_logs(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_ledger_payment_id
  ON public.payment_ledger(payment_id);
CREATE INDEX IF NOT EXISTS idx_seller_bank_profiles_seller_id
  ON public.seller_bank_profiles(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_categories_parent_id
  ON public.seller_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seller_categories_seller_id
  ON public.seller_categories(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_product_media_product_id
  ON public.seller_product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_seller_product_media_variant_id
  ON public.seller_product_media(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seller_reviews_order_id
  ON public.seller_reviews(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seller_shipments_seller_id
  ON public.seller_shipments(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_status_history_changed_by
  ON public.seller_status_history(changed_by) WHERE changed_by IS NOT NULL;
