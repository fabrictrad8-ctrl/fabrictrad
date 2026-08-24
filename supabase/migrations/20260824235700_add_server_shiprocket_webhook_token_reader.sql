-- Server-only Shiprocket webhook token reader.
-- The token value itself is stored in Supabase Vault and is never committed.
create or replace function public.get_server_shiprocket_webhook_token()
returns table(webhook_token text)
language sql
security definer
set search_path = ''
as $$
  select
    max(case when name = 'fabrictrad_shiprocket_webhook_token' then decrypted_secret end)::text as webhook_token
  from vault.decrypted_secrets
  where name = 'fabrictrad_shiprocket_webhook_token';
$$;

revoke all on function public.get_server_shiprocket_webhook_token() from public;
revoke all on function public.get_server_shiprocket_webhook_token() from anon;
revoke all on function public.get_server_shiprocket_webhook_token() from authenticated;
grant execute on function public.get_server_shiprocket_webhook_token() to service_role;
