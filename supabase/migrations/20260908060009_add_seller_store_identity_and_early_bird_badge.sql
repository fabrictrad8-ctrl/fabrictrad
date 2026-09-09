-- Reconstructed from the applied live migration 20260908060009_add_seller_store_identity_and_early_bird_badge.
-- Store identity: lets a seller name their storefront and claim a public URL handle.
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_handle text,
  ADD COLUMN IF NOT EXISTS store_bio text,
  ADD COLUMN IF NOT EXISTS store_banner_url text,
  ADD COLUMN IF NOT EXISTS is_early_bird boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_bird_rank integer,
  ADD COLUMN IF NOT EXISTS founding_seller_badge_awarded_at timestamptz;

-- Case-insensitive uniqueness on the public handle (nulls allowed, many sellers may not have set one yet).
CREATE UNIQUE INDEX IF NOT EXISTS seller_profiles_store_handle_unique_idx
  ON public.seller_profiles (lower(store_handle))
  WHERE store_handle IS NOT NULL;

-- Format guard: lowercase letters, digits and hyphens only, 3-40 chars, matching how the handle is used in URLs.
ALTER TABLE public.seller_profiles
  DROP CONSTRAINT IF EXISTS seller_profiles_store_handle_format_chk;
ALTER TABLE public.seller_profiles
  ADD CONSTRAINT seller_profiles_store_handle_format_chk
  CHECK (store_handle IS NULL OR store_handle ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- Early-bird founding-seller badge: the first 100 sellers to complete verification get it automatically.
CREATE OR REPLACE FUNCTION public.award_early_bird_seller_badge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  awarded_count integer;
begin
  if new.verification_status = 'verified' and (old.verification_status is distinct from 'verified') and new.is_early_bird is not true then
    select count(*) into awarded_count from public.seller_profiles where is_early_bird = true;
    if awarded_count < 100 then
      new.is_early_bird := true;
      new.early_bird_rank := awarded_count + 1;
      new.founding_seller_badge_awarded_at := now();
    end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_award_early_bird_seller_badge ON public.seller_profiles;
CREATE TRIGGER trg_award_early_bird_seller_badge
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.award_early_bird_seller_badge();

-- Backfill: any seller already verified before this migration existed joins the early-bird program too,
-- ranked by how long ago they were approved (oldest verified sellers rank first).
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY updated_at ASC) AS rn
  FROM public.seller_profiles
  WHERE verification_status = 'verified' AND is_early_bird = false
  LIMIT 100
)
UPDATE public.seller_profiles sp
SET is_early_bird = true, early_bird_rank = ranked.rn, founding_seller_badge_awarded_at = now()
FROM ranked
WHERE sp.id = ranked.id;
