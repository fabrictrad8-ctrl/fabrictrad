-- Tracking-only migration.
--
-- The account lifecycle schema was applied directly to the production project
-- as version 20260803164106 and committed as the idempotent 20260803164000
-- migration. Keeping this no-op version in source ensures that clean rebuilds,
-- Supabase Git deployments and the production migration ledger stay aligned.

DO $$
BEGIN
  IF to_regclass('public.onboarding_drafts') IS NULL
     OR to_regclass('public.account_deletion_requests') IS NULL THEN
    RAISE EXCEPTION 'The resumable account lifecycle migration must run first';
  END IF;
END;
$$;
