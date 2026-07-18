-- Migration: Auth enhancements — unique phone across roles, handle_new_user trigger update
-- Timestamp: 20260718300000

-- 1. Add unique constraint on phone in user_profiles (if not already unique)
-- First check if a unique index already exists, if not create one
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_phone_unique
  ON public.user_profiles (phone)
  WHERE phone IS NOT NULL;

-- 2. Update handle_new_user trigger to also capture role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'buyer'::public.user_role
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. RLS: Allow users to update their own phone
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. RLS: Allow users to read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 6. RLS: Allow checking phone uniqueness (read phone column for uniqueness check)
DROP POLICY IF EXISTS "users_check_phone_uniqueness" ON public.user_profiles;
CREATE POLICY "users_check_phone_uniqueness"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);
