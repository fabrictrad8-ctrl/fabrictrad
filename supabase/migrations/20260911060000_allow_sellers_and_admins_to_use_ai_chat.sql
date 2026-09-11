-- consume_ai_chat_quota admitted buyers only:
--   up.role = 'buyer' and up.can_buy = true, joined to an active buyer_profile.
-- The assistant widget is mounted in the seller dashboard and the admin portal
-- as well, with role-specific prompts, so for those two roles the function
-- returned false before inserting anything. The route reads that false as
-- exhaustion and replies "Daily AI chat limit reached", which is why a seller
-- who had never made a successful request was told they were out of quota and
-- why api_usage_daily held no row for them at all.
--
-- Any active account may now spend chat quota. The per-user daily ceiling is
-- unchanged and still enforced, so this widens who is metered, not how much.
create or replace function public.consume_ai_chat_quota(p_daily_limit integer default 100)
returns boolean
language plpgsql
security definer
set search_path to ''
as \$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_daily_limit, 100), 500));
  v_count integer;
begin
  if v_user_id is null then
    return false;
  end if;

  -- Active account, any role. Buyers still need a live buyer profile; sellers
  -- and administrators are admitted on their user_profile alone, because the
  -- assistant is part of their workspace too.
  if not exists (
    select 1
    from public.user_profiles up
    where up.id = v_user_id
      and up.is_active = true
      and (
        up.role <> 'buyer'::public.user_role
        or (
          up.can_buy = true
          and exists (
            select 1 from public.buyer_profiles bp
            where bp.user_id = up.id and bp.is_active = true
          )
        )
      )
  ) then
    return false;
  end if;

  insert into public.api_usage_daily(user_id, feature, usage_date, request_count, updated_at)
  values (v_user_id, 'ai_chat', (now() at time zone 'utc')::date, 1, now())
  on conflict (user_id, feature, usage_date)
  do update set
    request_count = public.api_usage_daily.request_count + 1,
    updated_at = now()
  where public.api_usage_daily.request_count < v_limit
  returning request_count into v_count;

  return v_count is not null and v_count <= v_limit;
end;
\$;
