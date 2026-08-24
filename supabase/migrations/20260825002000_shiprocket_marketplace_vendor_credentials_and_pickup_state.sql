alter table public.seller_profiles
  add column if not exists shiprocket_pickup_location text,
  add column if not exists shiprocket_pickup_registered boolean not null default false,
  add column if not exists shiprocket_pickup_synced_at timestamptz;

create unique index if not exists seller_profiles_shiprocket_pickup_location_unique
  on public.seller_profiles (lower(shiprocket_pickup_location))
  where shiprocket_pickup_location is not null;

create or replace function public.get_server_shiprocket_credentials()
returns table(api_email text, api_password text, webhook_token text)
language sql
security definer
set search_path = ''
as $function$
  select
    max(case when name = 'fabrictrad_shiprocket_api_email' then decrypted_secret end)::text,
    max(case when name = 'fabrictrad_shiprocket_api_password' then decrypted_secret end)::text,
    max(case when name = 'fabrictrad_shiprocket_webhook_token' then decrypted_secret end)::text
  from vault.decrypted_secrets
  where name in (
    'fabrictrad_shiprocket_api_email',
    'fabrictrad_shiprocket_api_password',
    'fabrictrad_shiprocket_webhook_token'
  );
$function$;

revoke all on function public.get_server_shiprocket_credentials() from public, anon, authenticated;
grant execute on function public.get_server_shiprocket_credentials() to postgres, service_role;
