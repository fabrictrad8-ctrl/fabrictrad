-- RLS does not protect TRUNCATE. Remove inherited/default grants and allow
-- authenticated users only the row-level operations protected by draft RLS.

REVOKE ALL ON TABLE public.onboarding_drafts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.onboarding_drafts TO authenticated;
