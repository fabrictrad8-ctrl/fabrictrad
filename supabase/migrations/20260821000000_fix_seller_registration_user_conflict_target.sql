-- Fix seller onboarding upserts used by public.request_seller_access(jsonb).
--
-- The function uses `ON CONFLICT (user_id)` for seller_registrations.
-- The previous uniqueness guarantee was a partial unique index with
-- `WHERE user_id IS NOT NULL`. PostgreSQL cannot infer that partial index
-- from a bare `ON CONFLICT (user_id)` target, so seller applications failed
-- with "there is no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- A normal UNIQUE constraint has the same desired behavior here: it prevents
-- duplicate non-null user IDs while still allowing multiple NULL values.

begin;

drop index if exists public.idx_seller_registrations_user_id_unique;

alter table public.seller_registrations
  add constraint seller_registrations_user_id_key unique (user_id);

commit;
