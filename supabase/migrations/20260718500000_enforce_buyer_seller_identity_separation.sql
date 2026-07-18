-- Enforce buyer/seller identity separation and save signup phone metadata.

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_phone_digits_unique
  ON public.user_profiles ((regexp_replace(phone, '\D', '', 'g')))
  WHERE phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_profiles_user_id_unique
  ON public.buyer_profiles (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_profiles_user_id_unique
  ON public.seller_profiles (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_profiles_gstin_unique
  ON public.buyer_profiles (upper(gstin))
  WHERE gstin IS NOT NULL AND trim(gstin) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_profiles_gstin_unique
  ON public.seller_profiles (upper(gstin))
  WHERE gstin IS NOT NULL AND trim(gstin) <> '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requested_role public.user_role;
  normalized_phone text;
BEGIN
  requested_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    'buyer'::public.user_role
  );
  normalized_phone := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '');

  IF normalized_phone IS NOT NULL THEN
    IF length(normalized_phone) <> 10 OR normalized_phone !~ '^[6-9]' THEN
      RAISE EXCEPTION 'A valid 10 digit Indian phone number is required';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE regexp_replace(phone, '\D', '', 'g') = normalized_phone
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'This phone number is already registered';
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, phone, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    normalized_phone,
    requested_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.user_profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_cross_role_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role public.user_role;
  normalized_gstin text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  normalized_gstin := NULLIF(upper(trim(NEW.gstin)), '');

  IF TG_TABLE_NAME = 'buyer_profiles' THEN
    IF user_role <> 'buyer'::public.user_role THEN
      RAISE EXCEPTION 'A seller account cannot be used as a buyer account';
    END IF;

    IF EXISTS (SELECT 1 FROM public.seller_profiles WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Buyer and seller profiles must belong to different users';
    END IF;

    IF normalized_gstin IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.seller_profiles WHERE upper(trim(gstin)) = normalized_gstin
    ) THEN
      RAISE EXCEPTION 'This GSTIN is already registered to a seller account';
    END IF;
  ELSIF TG_TABLE_NAME = 'seller_profiles' THEN
    IF user_role <> 'seller'::public.user_role THEN
      RAISE EXCEPTION 'A buyer account cannot be used as a seller account';
    END IF;

    IF EXISTS (SELECT 1 FROM public.buyer_profiles WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Buyer and seller profiles must belong to different users';
    END IF;

    IF normalized_gstin IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.buyer_profiles WHERE upper(trim(gstin)) = normalized_gstin
    ) THEN
      RAISE EXCEPTION 'This GSTIN is already registered to a buyer account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_identity_conflict(input_email text, input_phone text)
RETURNS TABLE (
  email_used boolean,
  email_role text,
  phone_used boolean,
  phone_role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      lower(NULLIF(trim(input_email), '')) AS email_value,
      NULLIF(regexp_replace(COALESCE(input_phone, ''), '\D', '', 'g'), '') AS phone_value
  ),
  email_match AS (
    SELECT up.role::text AS role
    FROM public.user_profiles up, normalized n
    WHERE n.email_value IS NOT NULL
      AND lower(up.email) = n.email_value
    LIMIT 1
  ),
  phone_match AS (
    SELECT up.role::text AS role
    FROM public.user_profiles up, normalized n
    WHERE n.phone_value IS NOT NULL
      AND regexp_replace(up.phone, '\D', '', 'g') = n.phone_value
    LIMIT 1
  )
  SELECT
    EXISTS (SELECT 1 FROM email_match) AS email_used,
    (SELECT role FROM email_match) AS email_role,
    EXISTS (SELECT 1 FROM phone_match) AS phone_used,
    (SELECT role FROM phone_match) AS phone_role;
$$;

GRANT EXECUTE ON FUNCTION public.check_identity_conflict(text, text) TO anon, authenticated;

DROP TRIGGER IF EXISTS prevent_buyer_profile_overlap ON public.buyer_profiles;
CREATE TRIGGER prevent_buyer_profile_overlap
  BEFORE INSERT OR UPDATE OF user_id, gstin ON public.buyer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cross_role_profile();

DROP TRIGGER IF EXISTS prevent_seller_profile_overlap ON public.seller_profiles;
CREATE TRIGGER prevent_seller_profile_overlap
  BEFORE INSERT OR UPDATE OF user_id, gstin ON public.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cross_role_profile();
