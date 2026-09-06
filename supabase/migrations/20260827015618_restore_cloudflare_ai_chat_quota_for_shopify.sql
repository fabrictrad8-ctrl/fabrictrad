create table if not exists public.api_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  usage_date date not null default ((now() at time zone 'utc')::date),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, usage_date)
);

alter table public.api_usage_daily enable row level security;
revoke all on table public.api_usage_daily from public, anon, authenticated;
grant all on table public.api_usage_daily to service_role;

create or replace function public.consume_ai_chat_quota(p_daily_limit integer default 100)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_daily_limit, 100), 500));
  v_count integer;
begin
  if v_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    join public.buyer_profiles bp on bp.user_id = up.id
    where up.id = v_user_id
      and up.is_active = true
      and up.role = 'buyer'::public.user_role
      and up.can_buy = true
      and bp.is_active = true
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
$$;

revoke all on function public.consume_ai_chat_quota(integer) from public, anon;
grant execute on function public.consume_ai_chat_quota(integer) to authenticated, service_role;

create or replace function public.consume_api_quota(p_feature text, p_daily_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feature text := lower(trim(coalesce(p_feature, '')));
begin
  if v_feature = 'ai_drape' then
    return public.consume_drape_quota(p_daily_limit);
  end if;
  if v_feature = 'ai_chat' then
    return public.consume_ai_chat_quota(p_daily_limit);
  end if;
  return false;
end;
$$;

revoke all on function public.consume_api_quota(text, integer) from public, anon;
grant execute on function public.consume_api_quota(text, integer) to authenticated, service_role;
