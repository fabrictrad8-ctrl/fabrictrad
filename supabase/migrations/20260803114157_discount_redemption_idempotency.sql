-- Count each discount campaign redemption at most once per bulk order.

CREATE TABLE IF NOT EXISTS public.discount_campaign_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.discount_campaigns(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.bulk_orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_campaign_redemptions_campaign_order_key UNIQUE (campaign_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_discount_campaign_redemptions_buyer
  ON public.discount_campaign_redemptions (buyer_id, created_at DESC);

ALTER TABLE public.discount_campaign_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS discount_campaign_redemptions_read_own
  ON public.discount_campaign_redemptions;
CREATE POLICY discount_campaign_redemptions_read_own
  ON public.discount_campaign_redemptions
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles profile
      WHERE profile.id = auth.uid()
        AND profile.is_active = true
        AND profile.role IN ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
    )
  );

REVOKE ALL ON TABLE public.discount_campaign_redemptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.discount_campaign_redemptions TO authenticated;
GRANT ALL ON TABLE public.discount_campaign_redemptions TO service_role;

CREATE OR REPLACE FUNCTION public.record_discount_redemption(
  p_campaign_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  inserted_redemption_id uuid;
  campaign_row public.discount_campaigns%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bulk_orders order_row
    WHERE order_row.id = p_order_id
      AND order_row.buyer_id = current_user_id
      AND order_row.discount_campaign_id = p_campaign_id
      AND order_row.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Order does not belong to the current buyer or campaign'
      USING ERRCODE = '42501';
  END IF;

  -- A retry for the same order is a successful no-op.
  IF EXISTS (
    SELECT 1
    FROM public.discount_campaign_redemptions redemption
    WHERE redemption.campaign_id = p_campaign_id
      AND redemption.order_id = p_order_id
      AND redemption.buyer_id = current_user_id
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO campaign_row
  FROM public.discount_campaigns campaign
  WHERE campaign.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND
    OR campaign_row.status <> 'active'
    OR current_date NOT BETWEEN campaign_row.start_date AND campaign_row.end_date THEN
    RAISE EXCEPTION 'Discount campaign is not active';
  END IF;

  IF campaign_row.usage_limit IS NOT NULL
    AND campaign_row.usage_count >= campaign_row.usage_limit THEN
    RAISE EXCEPTION 'Discount campaign usage limit has been reached';
  END IF;

  INSERT INTO public.discount_campaign_redemptions (
    campaign_id,
    order_id,
    buyer_id
  ) VALUES (
    p_campaign_id,
    p_order_id,
    current_user_id
  )
  ON CONFLICT (campaign_id, order_id) DO NOTHING
  RETURNING id INTO inserted_redemption_id;

  IF inserted_redemption_id IS NULL THEN
    RETURN true;
  END IF;

  UPDATE public.discount_campaigns
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = p_campaign_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_discount_redemption(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_discount_redemption(uuid, uuid)
  TO authenticated, service_role;
