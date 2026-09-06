revoke all on function public.get_signup_account_by_nonce(uuid,text) from public, anon, authenticated;
grant execute on function public.get_signup_account_by_nonce(uuid,text) to service_role;
