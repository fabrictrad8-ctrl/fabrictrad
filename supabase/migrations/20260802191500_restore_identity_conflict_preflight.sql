-- Restore the server-side identity preflight used by every registration flow.
--
-- The browser cannot read other users' profiles through RLS. Without this RPC,
-- an unavailable email/mobile number was incorrectly reported as available and
-- Supabase Auth later failed inside the new-user trigger with a unique-key error.
-- Return only the minimum conflict metadata needed to direct the person to sign
-- in and reuse the same FabricTrad account for buying and selling.

create or replace function public.check_identity_conflict(
  input_email text default null,
  input_phone text default null
)
returns table (
  email_used boolean,
  email_role text,
  phone_used boolean,
  phone_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      nullif(lower(btrim(coalesce(input_email, ''))), '') as email,
      nullif(right(regexp_replace(coalesce(input_phone, ''), '[^0-9]', '', 'g'), 10), '') as phone
  )
  select
    exists (
      select 1
      from public.user_profiles up, normalized n
      where n.email is not null
        and lower(up.email) = n.email
    ) as email_used,
    (
      select up.role::text
      from public.user_profiles up, normalized n
      where n.email is not null
        and lower(up.email) = n.email
      limit 1
    ) as email_role,
    exists (
      select 1
      from public.user_profiles up, normalized n
      where n.phone is not null
        and right(regexp_replace(coalesce(up.phone, ''), '[^0-9]', '', 'g'), 10) = n.phone
    ) as phone_used,
    (
      select up.role::text
      from public.user_profiles up, normalized n
      where n.phone is not null
        and right(regexp_replace(coalesce(up.phone, ''), '[^0-9]', '', 'g'), 10) = n.phone
      limit 1
    ) as phone_role;
$$;

revoke all on function public.check_identity_conflict(text, text) from public;
grant execute on function public.check_identity_conflict(text, text) to anon, authenticated;

comment on function public.check_identity_conflict(text, text) is
  'Returns minimal email/mobile conflict flags for buyer and seller registration preflight without exposing profile rows.';
