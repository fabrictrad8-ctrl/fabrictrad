-- WhatsApp-first buyer bespoke commerce.
-- Adds globally unique buyer store identities, a durable tailoring/customisation
-- workflow, appointment records, WhatsApp conversation state and follow-up jobs.

CREATE OR REPLACE FUNCTION public.fabrictrad_store_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.fabrictrad_store_handle(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both '-' from regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.buyer_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.buyer_profiles(id) ON DELETE SET NULL,
  store_name text NOT NULL,
  store_key text NOT NULL,
  store_handle text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'onboarding' CHECK (source IN ('onboarding','profile','whatsapp','admin')),
  whatsapp_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_stores_name_length CHECK (char_length(trim(store_name)) BETWEEN 3 AND 80),
  CONSTRAINT buyer_stores_key_nonempty CHECK (char_length(store_key) >= 3),
  CONSTRAINT buyer_stores_handle_format CHECK (store_handle ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')
);

CREATE UNIQUE INDEX IF NOT EXISTS buyer_stores_store_key_unique_idx
  ON public.buyer_stores (store_key);
CREATE UNIQUE INDEX IF NOT EXISTS buyer_stores_store_handle_unique_idx
  ON public.buyer_stores (store_handle);
CREATE UNIQUE INDEX IF NOT EXISTS buyer_stores_one_primary_per_user_idx
  ON public.buyer_stores (user_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS buyer_stores_user_idx
  ON public.buyer_stores (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buyer_stores_whatsapp_phone_idx
  ON public.buyer_stores (whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.buyer_stores_normalize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.store_name := trim(NEW.store_name);
  NEW.store_key := public.fabrictrad_store_key(NEW.store_name);
  IF coalesce(trim(NEW.store_handle), '') = '' THEN
    NEW.store_handle := public.fabrictrad_store_handle(NEW.store_name);
  ELSE
    NEW.store_handle := public.fabrictrad_store_handle(NEW.store_handle);
  END IF;
  NEW.whatsapp_phone := nullif(regexp_replace(coalesce(NEW.whatsapp_phone, ''), '[^0-9]+', '', 'g'), '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS buyer_stores_normalize_trigger ON public.buyer_stores;
CREATE TRIGGER buyer_stores_normalize_trigger
BEFORE INSERT OR UPDATE OF store_name, store_handle, whatsapp_phone
ON public.buyer_stores
FOR EACH ROW EXECUTE FUNCTION public.buyer_stores_normalize();

CREATE TABLE IF NOT EXISTS public.bespoke_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.buyer_profiles(id) ON DELETE SET NULL,
  buyer_store_id uuid REFERENCES public.buyer_stores(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.seller_products(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'website' CHECK (source IN ('website','whatsapp','admin')),
  whatsapp_phone text,
  stage text NOT NULL DEFAULT 'catalogue' CHECK (stage IN (
    'catalogue','product','reference_image','fabric','customization','measurement',
    'appointment','quotation','advance_or_full_payment','stitching','embroidery',
    'trial','alteration','final_approval','balance_payment','delivery_or_pickup',
    'review','follow_up','completed','cancelled'
  )),
  reference_image_path text,
  reference_image_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  fabric_selection jsonb NOT NULL DEFAULT '{}'::jsonb,
  customization jsonb NOT NULL DEFAULT '{}'::jsonb,
  measurement jsonb NOT NULL DEFAULT '{}'::jsonb,
  quotation jsonb NOT NULL DEFAULT '{}'::jsonb,
  quoted_amount numeric(12,2) CHECK (quoted_amount IS NULL OR quoted_amount >= 0),
  advance_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (advance_amount >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
  payment_choice text CHECK (payment_choice IS NULL OR payment_choice IN ('advance','full')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','payment_link_created','part_paid','paid','failed','refunded')),
  razorpay_order_id text,
  razorpay_payment_id text,
  stitching_status text NOT NULL DEFAULT 'not_started' CHECK (stitching_status IN ('not_started','queued','in_progress','completed')),
  embroidery_status text NOT NULL DEFAULT 'not_required' CHECK (embroidery_status IN ('not_required','queued','in_progress','completed')),
  human_action_required boolean NOT NULL DEFAULT false,
  human_action_reason text CHECK (human_action_reason IS NULL OR human_action_reason IN ('physical_measurement','design_approval','trial_fitting','alteration','customer_service')),
  delivery_mode text CHECK (delivery_mode IS NULL OR delivery_mode IN ('delivery','pickup')),
  delivery_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_rating smallint CHECK (review_rating IS NULL OR review_rating BETWEEN 1 AND 5),
  review_text text,
  final_approved_at timestamptz,
  completed_at timestamptz,
  follow_up_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bespoke_orders_user_created_idx
  ON public.bespoke_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bespoke_orders_store_created_idx
  ON public.bespoke_orders (buyer_store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bespoke_orders_stage_idx
  ON public.bespoke_orders (stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS bespoke_orders_follow_up_idx
  ON public.bespoke_orders (follow_up_due_at)
  WHERE follow_up_due_at IS NOT NULL AND stage <> 'completed';

CREATE TABLE IF NOT EXISTS public.bespoke_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_order_id uuid NOT NULL REFERENCES public.bespoke_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_type text NOT NULL CHECK (appointment_type IN ('physical_measurement','design_approval','trial_fitting','alteration')),
  requested_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 240),
  location_type text NOT NULL DEFAULT 'store' CHECK (location_type IN ('store','customer_address','video_call','other')),
  location_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','completed','cancelled','reschedule_requested','no_show')),
  staff_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bespoke_appointments_user_time_idx
  ON public.bespoke_appointments (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS bespoke_appointments_order_idx
  ON public.bespoke_appointments (bespoke_order_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_buyer_sessions (
  whatsapp_phone text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_store_id uuid REFERENCES public.buyer_stores(id) ON DELETE SET NULL,
  active_order_id uuid REFERENCES public.bespoke_orders(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'catalogue',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  human_handoff_required boolean NOT NULL DEFAULT false,
  human_handoff_reason text,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_buyer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id text NOT NULL UNIQUE,
  whatsapp_phone text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bespoke_order_id uuid REFERENCES public.bespoke_orders(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL DEFAULT 'text',
  message_text text,
  media_id text,
  media_storage_path text,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processed','needs_human','failed','ignored')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_buyer_messages_phone_created_idx
  ON public.whatsapp_buyer_messages (whatsapp_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_buyer_messages_order_created_idx
  ON public.whatsapp_buyer_messages (bespoke_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bespoke_follow_up_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_order_id uuid NOT NULL REFERENCES public.bespoke_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_phone text,
  job_type text NOT NULL CHECK (job_type IN ('appointment_reminder','payment_reminder','trial_reminder','delivery_update','review_request','post_delivery_follow_up')),
  due_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','cancelled','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bespoke_follow_up_jobs_due_idx
  ON public.bespoke_follow_up_jobs (due_at, status)
  WHERE status = 'pending';

ALTER TABLE public.buyer_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bespoke_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bespoke_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_buyer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_buyer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bespoke_follow_up_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buyer_stores_read_own ON public.buyer_stores;
CREATE POLICY buyer_stores_read_own ON public.buyer_stores
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS buyer_stores_insert_own ON public.buyer_stores;
CREATE POLICY buyer_stores_insert_own ON public.buyer_stores
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS buyer_stores_update_own ON public.buyer_stores;
CREATE POLICY buyer_stores_update_own ON public.buyer_stores
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bespoke_orders_read_own ON public.bespoke_orders;
CREATE POLICY bespoke_orders_read_own ON public.bespoke_orders
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS bespoke_orders_insert_own ON public.bespoke_orders;
CREATE POLICY bespoke_orders_insert_own ON public.bespoke_orders
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS bespoke_orders_update_own ON public.bespoke_orders;
CREATE POLICY bespoke_orders_update_own ON public.bespoke_orders
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS bespoke_appointments_read_own ON public.bespoke_appointments;
CREATE POLICY bespoke_appointments_read_own ON public.bespoke_appointments
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS bespoke_appointments_insert_own ON public.bespoke_appointments;
CREATE POLICY bespoke_appointments_insert_own ON public.bespoke_appointments
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS bespoke_appointments_update_own ON public.bespoke_appointments;
CREATE POLICY bespoke_appointments_update_own ON public.bespoke_appointments
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.whatsapp_buyer_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_buyer_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.bespoke_follow_up_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_buyer_sessions TO service_role;
GRANT ALL ON TABLE public.whatsapp_buyer_messages TO service_role;
GRANT ALL ON TABLE public.bespoke_follow_up_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.buyer_stores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bespoke_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bespoke_appointments TO authenticated;
GRANT ALL ON TABLE public.buyer_stores TO service_role;
GRANT ALL ON TABLE public.bespoke_orders TO service_role;
GRANT ALL ON TABLE public.bespoke_appointments TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'buyer-reference-images',
  'buyer-reference-images',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS buyer_reference_images_insert_own ON storage.objects;
CREATE POLICY buyer_reference_images_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'buyer-reference-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
DROP POLICY IF EXISTS buyer_reference_images_read_own ON storage.objects;
CREATE POLICY buyer_reference_images_read_own ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'buyer-reference-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
DROP POLICY IF EXISTS buyer_reference_images_update_own ON storage.objects;
CREATE POLICY buyer_reference_images_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'buyer-reference-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'buyer-reference-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
DROP POLICY IF EXISTS buyer_reference_images_delete_own ON storage.objects;
CREATE POLICY buyer_reference_images_delete_own ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'buyer-reference-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

COMMENT ON TABLE public.buyer_stores IS 'Globally unique customer-facing store identities owned by FabricTrad buyers.';
COMMENT ON TABLE public.bespoke_orders IS 'WhatsApp/web bespoke order workflow from catalogue through review and automated follow-up.';
COMMENT ON TABLE public.whatsapp_buyer_sessions IS 'State machine for inbound buyer WhatsApp conversations.';