-- The registration fallback proves possession of a fresh high-entropy signup
-- nonce. Mark that one transaction as trusted so existing trigger guards permit
-- the security-definer onboarding functions to write review-protected fields.

CREATE OR REPLACE FUNCTION public.is_valid_registration_nonce(
  p_user_id uuid,
  p_nonce text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  nonce_is_valid boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = p_user_id
      AND auth_user.created_at >= now() - interval '2 hours'
      AND length(COALESCE(p_nonce, '')) >= 20
      AND auth_user.raw_user_meta_data->>'registration_nonce' = p_nonce
  ) INTO nonce_is_valid;

  IF nonce_is_valid THEN
    -- Supabase/PostgREST installations may expose the role through either the
    -- legacy individual claim setting or the JSON claims setting. Set both for
    -- this transaction only, after the nonce has been verified.
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('role', 'service_role', 'sub', p_user_id::text)::text,
      true
    );
  END IF;

  RETURN nonce_is_valid;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_registration_nonce(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_registration_nonce(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_valid_seller_registration_upload_path(p_name text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  path_parts text[];
  target_user_id uuid;
  target_nonce text;
BEGIN
  path_parts := storage.foldername(p_name);
  IF array_length(path_parts, 1) < 2 THEN
    RETURN false;
  END IF;

  BEGIN
    target_user_id := path_parts[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  target_nonce := path_parts[2];

  RETURN public.is_valid_registration_nonce(target_user_id, target_nonce)
    AND EXISTS (
      SELECT 1 FROM auth.users AS auth_user
      WHERE auth_user.id = target_user_id
        AND auth_user.raw_user_meta_data->>'role' = 'seller'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_seller_registration_upload_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_seller_registration_upload_path(text) TO anon, authenticated, service_role;
