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
