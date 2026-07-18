-- Migration: seller_reviews table for buyer-submitted ratings and text reviews
-- Timestamp: 20260717240000

-- Create seller_reviews table
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.buyer_profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text NOT NULL CHECK (char_length(title) <= 80),
  body text NOT NULL CHECK (char_length(body) <= 500),
  is_verified_purchase boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, buyer_id, order_id)
);

-- Index for fast seller aggregate queries
CREATE INDEX IF NOT EXISTS idx_seller_reviews_seller_id ON public.seller_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_buyer_id ON public.seller_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_rating ON public.seller_reviews(seller_id, rating);

-- View: seller aggregate ratings (used by SellerCard, AdminTopSellers)
CREATE OR REPLACE VIEW public.seller_rating_aggregates AS
SELECT
  seller_id,
  COUNT(*)::integer AS review_count,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*) FILTER (WHERE rating = 5)::integer AS five_star,
  COUNT(*) FILTER (WHERE rating = 4)::integer AS four_star,
  COUNT(*) FILTER (WHERE rating = 3)::integer AS three_star,
  COUNT(*) FILTER (WHERE rating = 2)::integer AS two_star,
  COUNT(*) FILTER (WHERE rating = 1)::integer AS one_star
FROM public.seller_reviews
GROUP BY seller_id;

-- RLS
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;

-- Buyers can read all reviews
CREATE POLICY "seller_reviews_read_all"
  ON public.seller_reviews
  FOR SELECT
  USING (true);

-- Buyers can insert their own reviews
CREATE POLICY "seller_reviews_buyer_insert"
  ON public.seller_reviews
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = seller_reviews.buyer_id
        AND bp.user_id = auth.uid()
    )
  );

-- Buyers can update their own reviews
CREATE POLICY "seller_reviews_buyer_update"
  ON public.seller_reviews
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = seller_reviews.buyer_id
        AND bp.user_id = auth.uid()
    )
  );

-- Admins can manage all reviews
CREATE POLICY "seller_reviews_admin_all"
  ON public.seller_reviews
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
    )
  );

-- Trigger: update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_seller_review_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seller_reviews_updated_at'
  ) THEN
    CREATE TRIGGER trg_seller_reviews_updated_at
      BEFORE UPDATE ON public.seller_reviews
      FOR EACH ROW EXECUTE FUNCTION public.update_seller_review_timestamp();
  END IF;
END;
$$;
