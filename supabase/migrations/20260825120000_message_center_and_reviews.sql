-- Message threads and messages for buyer-seller communication
-- Idempotent migration

CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_number bigint GENERATED ALWAYS AS IDENTITY,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  last_message text NOT NULL DEFAULT '',
  last_at timestamptz NOT NULL DEFAULT now(),
  unread_buyer integer NOT NULL DEFAULT 0,
  unread_seller integer NOT NULL DEFAULT 0,
  buyer_name text NOT NULL DEFAULT '',
  seller_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('buyer', 'seller')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_threads_buyer_id ON public.message_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_seller_id ON public.message_threads(seller_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_at ON public.message_threads(last_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- RLS
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Thread policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_threads' AND policyname = 'thread_participant_select') THEN
    CREATE POLICY thread_participant_select ON public.message_threads
      FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_threads' AND policyname = 'thread_buyer_insert') THEN
    CREATE POLICY thread_buyer_insert ON public.message_threads
      FOR INSERT WITH CHECK (auth.uid() = buyer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_threads' AND policyname = 'thread_participant_update') THEN
    CREATE POLICY thread_participant_update ON public.message_threads
      FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
  END IF;
END $$;

-- Message policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'message_participant_select') THEN
    CREATE POLICY message_participant_select ON public.messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.message_threads t
          WHERE t.id = thread_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'message_participant_insert') THEN
    CREATE POLICY message_participant_insert ON public.messages
      FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
          SELECT 1 FROM public.message_threads t
          WHERE t.id = thread_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
        )
      );
  END IF;
END $$;

-- seller_reviews table (if not exists)
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_name text NOT NULL DEFAULT 'Verified Buyer',
  buyer_city text NOT NULL DEFAULT '',
  overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  fabric_quality_rating integer NOT NULL DEFAULT 0 CHECK (fabric_quality_rating BETWEEN 0 AND 5),
  seller_service_rating integer NOT NULL DEFAULT 0 CHECK (seller_service_rating BETWEEN 0 AND 5),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  verified_purchase boolean NOT NULL DEFAULT false,
  order_ref text NOT NULL DEFAULT '',
  helpful_count integer NOT NULL DEFAULT 0,
  photo_urls text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_reviews_seller_id ON public.seller_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_buyer_id ON public.seller_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_created_at ON public.seller_reviews(created_at DESC);

ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_reviews' AND policyname = 'reviews_public_select') THEN
    CREATE POLICY reviews_public_select ON public.seller_reviews FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_reviews' AND policyname = 'reviews_buyer_insert') THEN
    CREATE POLICY reviews_buyer_insert ON public.seller_reviews
      FOR INSERT WITH CHECK (auth.uid() = buyer_id);
  END IF;
END $$;

-- Helper function for incrementing helpful count
CREATE OR REPLACE FUNCTION public.increment_review_helpful(review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.seller_reviews SET helpful_count = helpful_count + 1 WHERE id = review_id;
END;
$$;
