-- ---------------------------------------------------------------------------
-- Daily API quotas. The function updates only the caller's row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, usage_date)
);

ALTER TABLE public.api_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_quota(
  p_feature text,
  p_daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF auth.uid() IS NULL OR p_daily_limit < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_usage_daily (user_id, feature, usage_date, request_count)
  VALUES (auth.uid(), p_feature, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature, usage_date)
  DO UPDATE SET
    request_count = public.api_usage_daily.request_count + 1,
    updated_at = now()
  WHERE public.api_usage_daily.request_count < p_daily_limit
  RETURNING request_count INTO new_count;

  RETURN new_count IS NOT NULL AND new_count <= p_daily_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_quota(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_api_quota(text, integer) TO authenticated;
