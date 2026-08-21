create or replace function public.consume_drape_quota(p_daily_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_buyer_id uuid;
  v_count integer;
  v_paid boolean;
  v_limit integer := greatest(1, least(coalesce(p_daily_limit, 10), 100));
begin
  if v_user_id is null then
    return false;
  end if;

  select bp.id
  into v_buyer_id
  from public.buyer_profiles bp
  join public.user_profiles up on up.id = bp.user_id
  where bp.user_id = v_user_id
    and up.is_active = true
    and up.can_buy = true
  limit 1;

  if v_buyer_id is null then
    return false;
  end if;

  insert into public.drape_usage (buyer_id, usage_date, drape_count, is_paid, updated_at)
  values (v_buyer_id, current_date, 0, false, now())
  on conflict (buyer_id, usage_date) do nothing;

  select du.drape_count, du.is_paid
  into v_count, v_paid
  from public.drape_usage du
  where du.buyer_id = v_buyer_id
    and du.usage_date = current_date
  for update;

  if coalesce(v_paid, false) then
    update public.drape_usage
    set drape_count = drape_count + 1,
        updated_at = now()
    where buyer_id = v_buyer_id
      and usage_date = current_date;
    return true;
  end if;

  if coalesce(v_count, 0) >= v_limit then
    return false;
  end if;

  update public.drape_usage
  set drape_count = drape_count + 1,
      updated_at = now()
  where buyer_id = v_buyer_id
    and usage_date = current_date;

  return true;
end;
$$;

revoke all on function public.consume_drape_quota(integer) from public;
revoke all on function public.consume_drape_quota(integer) from anon;
grant execute on function public.consume_drape_quota(integer) to authenticated;

-- Backwards-compatible feature gate used by the current server route. Only the
-- buyer AI drape feature is enabled here; unknown feature names fail closed.
create or replace function public.consume_api_quota(p_feature text, p_daily_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_feature = 'ai_drape' then
    return public.consume_drape_quota(p_daily_limit);
  end if;
  return false;
end;
$$;

revoke all on function public.consume_api_quota(text, integer) from public;
revoke all on function public.consume_api_quota(text, integer) from anon;
grant execute on function public.consume_api_quota(text, integer) to authenticated;
