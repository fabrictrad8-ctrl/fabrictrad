-- Rate-limit application-owned authentication email delivery.
create table if not exists public.auth_email_delivery_state (
  email text not null,
  purpose text not null check (purpose in ('admin_otp', 'password_recovery')),
  last_requested_at timestamptz,
  day_started_at date not null default ((now() at time zone 'utc')::date),
  daily_count integer not null default 0 check (daily_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (email, purpose)
);

alter table public.auth_email_delivery_state enable row level security;
revoke all on table public.auth_email_delivery_state from public, anon, authenticated;

create or replace function public.claim_auth_email_delivery(
  p_email text,
  p_purpose text,
  p_cooldown_seconds integer default 60,
  p_daily_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_purpose text := lower(btrim(coalesce(p_purpose, '')));
  v_cooldown integer := greatest(30, least(coalesce(p_cooldown_seconds, 60), 600));
  v_daily_limit integer := greatest(1, least(coalesce(p_daily_limit, 10), 100));
  v_now timestamptz := now();
  v_today date := (now() at time zone 'utc')::date;
  v_state public.auth_email_delivery_state%rowtype;
  v_retry_after integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service-role access is required.' using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'A valid email is required.' using errcode = '22023';
  end if;

  if v_purpose not in ('admin_otp', 'password_recovery') then
    raise exception 'Unsupported email purpose.' using errcode = '22023';
  end if;

  insert into public.auth_email_delivery_state (email, purpose, day_started_at, daily_count, updated_at)
  values (v_email, v_purpose, v_today, 0, v_now)
  on conflict (email, purpose) do nothing;

  select *
  into v_state
  from public.auth_email_delivery_state
  where email = v_email and purpose = v_purpose
  for update;

  if v_state.day_started_at is distinct from v_today then
    update public.auth_email_delivery_state
    set day_started_at = v_today,
        daily_count = 0,
        last_requested_at = null,
        updated_at = v_now
    where email = v_email and purpose = v_purpose
    returning * into v_state;
  end if;

  if v_state.last_requested_at is not null
     and v_state.last_requested_at > v_now - make_interval(secs => v_cooldown) then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_state.last_requested_at + make_interval(secs => v_cooldown)) - v_now)))::integer
    );
    return jsonb_build_object('allowed', false, 'reason', 'cooldown', 'retryAfter', v_retry_after);
  end if;

  if v_state.daily_count >= v_daily_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (((v_today + 1)::timestamp at time zone 'utc') - v_now)))::integer
    );
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'retryAfter', v_retry_after);
  end if;

  update public.auth_email_delivery_state
  set last_requested_at = v_now,
      daily_count = daily_count + 1,
      updated_at = v_now
  where email = v_email and purpose = v_purpose;

  return jsonb_build_object('allowed', true, 'reason', 'accepted', 'retryAfter', v_cooldown);
end;
$$;

revoke all on function public.claim_auth_email_delivery(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_auth_email_delivery(text, text, integer, integer) to service_role;
