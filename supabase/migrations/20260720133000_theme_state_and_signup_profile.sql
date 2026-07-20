-- Persist appearance, language and complete regional onboarding preferences.
-- Keeps public sign-up roles restricted to buyer/seller and never trusts user metadata for admin access.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_theme TEXT NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_preferred_theme_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_preferred_theme_check
      CHECK (preferred_theme IN ('light', 'dark', 'system'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requested_role public.user_role;
  normalized_phone text;
  preferred_language_value text;
  preferred_theme_value text;
BEGIN
  requested_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'seller' THEN 'seller'::public.user_role
    ELSE 'buyer'::public.user_role
  END;

  normalized_phone := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'),
    ''
  );

  IF normalized_phone IS NOT NULL
     AND (length(normalized_phone) <> 10 OR normalized_phone !~ '^[6-9]') THEN
    RAISE EXCEPTION 'A valid 10 digit Indian phone number is required';
  END IF;

  preferred_language_value := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te')
      THEN NEW.raw_user_meta_data->>'preferred_language'
    ELSE 'en'
  END;

  preferred_theme_value := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_theme' IN ('light', 'dark', 'system')
      THEN NEW.raw_user_meta_data->>'preferred_theme'
    ELSE 'system'
  END;

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    role,
    business_name,
    gstin,
    address_line1,
    address_line2,
    city,
    state,
    pincode,
    preferred_language,
    preferred_theme
  )
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    normalized_phone,
    requested_role,
    NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
    NULLIF(upper(NEW.raw_user_meta_data->>'gstin'), ''),
    NULLIF(NEW.raw_user_meta_data->>'address_line1', ''),
    NULLIF(NEW.raw_user_meta_data->>'address_line2', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'pincode', ''),
    preferred_language_value,
    preferred_theme_value
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    business_name = COALESCE(EXCLUDED.business_name, public.user_profiles.business_name),
    gstin = COALESCE(EXCLUDED.gstin, public.user_profiles.gstin),
    address_line1 = COALESCE(EXCLUDED.address_line1, public.user_profiles.address_line1),
    address_line2 = COALESCE(EXCLUDED.address_line2, public.user_profiles.address_line2),
    city = COALESCE(EXCLUDED.city, public.user_profiles.city),
    state = COALESCE(EXCLUDED.state, public.user_profiles.state),
    pincode = COALESCE(EXCLUDED.pincode, public.user_profiles.pincode),
    preferred_language = EXCLUDED.preferred_language,
    preferred_theme = EXCLUDED.preferred_theme,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;
