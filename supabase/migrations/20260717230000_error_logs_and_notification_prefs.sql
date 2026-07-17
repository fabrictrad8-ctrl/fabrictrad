-- Migration: error_logs and notification_preferences tables
-- Timestamp: 20260717230000

-- Error logs table for production error monitoring
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type text NOT NULL CHECK (error_type IN ('razorpay', 'shiprocket', 'rls', 'webhook', 'general')),
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message text NOT NULL,
  details text,
  affected_entity text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.user_profiles(id),
  occurrence_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  topic_label text NOT NULL,
  category text NOT NULL CHECK (category IN ('orders', 'disputes', 'payouts', 'marketing', 'security')),
  is_critical boolean DEFAULT false,
  sms_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  in_app_enabled boolean DEFAULT true,
  frequency text DEFAULT 'instant' CHECK (frequency IN ('instant', 'daily', 'off')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

-- Seller status history for audit trail
CREATE TABLE IF NOT EXISTS public.seller_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_status_history_seller ON public.seller_status_history(seller_id);

-- RLS Policies for error_logs
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'error_logs' AND policyname = 'admin_all_error_logs') THEN
    CREATE POLICY admin_all_error_logs ON public.error_logs
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('super_admin', 'admin_staff')
        )
      );
  END IF;
END $$;

-- RLS Policies for notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_preferences' AND policyname = 'users_own_notification_prefs') THEN
    CREATE POLICY users_own_notification_prefs ON public.notification_preferences
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_preferences' AND policyname = 'admin_all_notification_prefs') THEN
    CREATE POLICY admin_all_notification_prefs ON public.notification_preferences
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('super_admin', 'admin_staff')
        )
      );
  END IF;
END $$;

-- RLS for seller_status_history
ALTER TABLE public.seller_status_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_status_history' AND policyname = 'admin_all_seller_status_history') THEN
    CREATE POLICY admin_all_seller_status_history ON public.seller_status_history
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('super_admin', 'admin_staff')
        )
      );
  END IF;
END $$;
