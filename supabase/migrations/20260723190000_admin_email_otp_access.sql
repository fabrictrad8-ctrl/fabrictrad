-- Allow the designated FabricTrad business email to claim the trusted admin role
-- only after Supabase has verified possession of that inbox.

CREATE OR REPLACE FUNCTION public.claim_fabrictrad_admin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(email)
  INTO current_email
  FROM auth.users
  WHERE id = auth.uid();

  IF current_email IS DISTINCT FROM 'fabrictrad8@gmail.com' THEN
    RAISE EXCEPTION 'This email is not authorised for administration';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb,
      updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    updated_at
  )
  VALUES (
    auth.uid(),
    'fabrictrad8@gmail.com',
    'FabricTrad Administrator',
    'super_admin'::public.user_role,
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'super_admin'::public.user_role,
    is_active = true,
    updated_at = now();

  RETURN 'super_admin';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_fabrictrad_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_fabrictrad_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND (
        raw_app_meta_data->>'role' IN ('super_admin', 'admin_staff')
        OR lower(email) = 'fabrictrad8@gmail.com'
      )
  );
$$;

-- Upgrade the existing account immediately when the migration is applied.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb,
    updated_at = now()
WHERE lower(email) = 'fabrictrad8@gmail.com';

UPDATE public.user_profiles AS profile
SET role = 'super_admin'::public.user_role,
    is_active = true,
    updated_at = now()
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND lower(auth_user.email) = 'fabrictrad8@gmail.com';
