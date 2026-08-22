create or replace view public.seller_directory
with (security_barrier = true, security_invoker = true)
as
select
  sp.id,
  sp.display_name,
  sp.legal_business_name
from public.seller_profiles sp
where sp.is_active = true
  and sp.verification_status = 'verified';

revoke all on public.seller_directory from anon;
grant select on public.seller_directory to authenticated;
