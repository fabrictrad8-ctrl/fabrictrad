-- Migration: buyer_requirements_and_chat
-- Creates tables for buyer requirements board and in-website chat

-- Buyer Requirements table
CREATE TABLE IF NOT EXISTS public.buyer_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity TEXT NOT NULL,
  budget TEXT NOT NULL,
  deadline DATE,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_discussion', 'fulfilled', 'closed')),
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat threads table (connects two parties around a context)
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL CHECK (context_type IN ('product_inquiry', 'requirement_response', 'post_purchase')),
  context_id TEXT NOT NULL,
  context_title TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  buyer_unread INTEGER DEFAULT 0,
  seller_unread INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'seller', 'system')),
  message_text TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('image', 'document', 'pdf', 'video')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buyer_requirements_buyer_id ON public.buyer_requirements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_requirements_status ON public.buyer_requirements(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_buyer_id ON public.chat_threads(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_seller_id ON public.chat_threads(seller_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);

-- Updated_at trigger for buyer_requirements
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_buyer_requirements_updated_at'
  ) THEN
    CREATE TRIGGER set_buyer_requirements_updated_at
      BEFORE UPDATE ON public.buyer_requirements
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS Policies

ALTER TABLE public.buyer_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- buyer_requirements: anyone can read open requirements, buyers manage their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buyer_requirements' AND policyname = 'Anyone can view open requirements') THEN
    CREATE POLICY "Anyone can view open requirements"
      ON public.buyer_requirements FOR SELECT
      USING (status = 'open' OR auth.uid() = buyer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buyer_requirements' AND policyname = 'Buyers can insert own requirements') THEN
    CREATE POLICY "Buyers can insert own requirements"
      ON public.buyer_requirements FOR INSERT
      WITH CHECK (auth.uid() = buyer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buyer_requirements' AND policyname = 'Buyers can update own requirements') THEN
    CREATE POLICY "Buyers can update own requirements"
      ON public.buyer_requirements FOR UPDATE
      USING (auth.uid() = buyer_id);
  END IF;
END $$;

-- chat_threads: only participants can see their threads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_threads' AND policyname = 'Participants can view their threads') THEN
    CREATE POLICY "Participants can view their threads"
      ON public.chat_threads FOR SELECT
      USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_threads' AND policyname = 'Participants can insert threads') THEN
    CREATE POLICY "Participants can insert threads"
      ON public.chat_threads FOR INSERT
      WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_threads' AND policyname = 'Participants can update threads') THEN
    CREATE POLICY "Participants can update threads"
      ON public.chat_threads FOR UPDATE
      USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
  END IF;
END $$;

-- chat_messages: only thread participants can read/write
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Thread participants can view messages') THEN
    CREATE POLICY "Thread participants can view messages"
      ON public.chat_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_threads ct
          WHERE ct.id = thread_id
          AND (ct.buyer_id = auth.uid() OR ct.seller_id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Thread participants can insert messages') THEN
    CREATE POLICY "Thread participants can insert messages"
      ON public.chat_messages FOR INSERT
      WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
          SELECT 1 FROM public.chat_threads ct
          WHERE ct.id = thread_id
          AND (ct.buyer_id = auth.uid() OR ct.seller_id = auth.uid())
        )
      );
  END IF;
END $$;
