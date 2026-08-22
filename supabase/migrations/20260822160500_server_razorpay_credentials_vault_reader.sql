create or replace function public.get_server_razorpay_credentials()
returns table(key_id text, key_secret text)
language sql
security definer
set search_path = ''
as $$
  select
    max(case when name = 'fabrictrad_razorpay_key_id' then decrypted_secret end)::text as key_id,
    max(case when name = 'fabrictrad_razorpay_key_secret' then decrypted_secret end)::text as key_secret
  from vault.decrypted_secrets
  where name in ('fabrictrad_razorpay_key_id', 'fabrictrad_razorpay_key_secret');
$$;

revoke all on function public.get_server_razorpay_credentials() from public;
revoke all on function public.get_server_razorpay_credentials() from anon;
revoke all on function public.get_server_razorpay_credentials() from authenticated;
grant execute on function public.get_server_razorpay_credentials() to service_role;
