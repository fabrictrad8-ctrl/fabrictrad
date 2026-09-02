-- Cover foreign keys used by the WhatsApp/bespoke workflow. These indexes
-- keep user deletion, order cleanup, admin queues and session lookup efficient
-- as the conversation and payment ledgers grow.

CREATE INDEX IF NOT EXISTS bespoke_follow_up_jobs_order_idx
  ON public.bespoke_follow_up_jobs (bespoke_order_id);
CREATE INDEX IF NOT EXISTS bespoke_follow_up_jobs_user_idx
  ON public.bespoke_follow_up_jobs (user_id);

CREATE INDEX IF NOT EXISTS bespoke_orders_buyer_idx
  ON public.bespoke_orders (buyer_id)
  WHERE buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bespoke_orders_product_idx
  ON public.bespoke_orders (product_id)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bespoke_refunds_user_idx
  ON public.bespoke_refunds (user_id);

CREATE INDEX IF NOT EXISTS buyer_stores_buyer_idx
  ON public.buyer_stores (buyer_id)
  WHERE buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_buyer_messages_user_idx
  ON public.whatsapp_buyer_messages (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_buyer_sessions_user_idx
  ON public.whatsapp_buyer_sessions (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_buyer_sessions_store_idx
  ON public.whatsapp_buyer_sessions (buyer_store_id)
  WHERE buyer_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_buyer_sessions_order_idx
  ON public.whatsapp_buyer_sessions (active_order_id)
  WHERE active_order_id IS NOT NULL;
