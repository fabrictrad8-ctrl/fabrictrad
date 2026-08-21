-- A verified seller has completed the strongest FabricTrad business identity review.
-- Keep the shared account summary in sync so dual-workspace accounts do not show
-- a stale global "Pending" state after seller approval.

create or replace function public.sync_verified_seller_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status = 'verified'::public.seller_status then
    update public.user_profiles
    set verification_status = 'verified',
        updated_at = now()
    where id = new.user_id
      and verification_status is distinct from 'verified';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_verified_seller_account_status() from public;
revoke all on function public.sync_verified_seller_account_status() from anon;
revoke all on function public.sync_verified_seller_account_status() from authenticated;
grant execute on function public.sync_verified_seller_account_status() to service_role;

drop trigger if exists sync_verified_seller_account_status_trigger on public.seller_profiles;
create trigger sync_verified_seller_account_status_trigger
after insert or update of verification_status on public.seller_profiles
for each row
when (new.verification_status = 'verified'::public.seller_status)
execute function public.sync_verified_seller_account_status();

-- Repair already-approved sellers created before this trigger existed.
update public.user_profiles as account
set verification_status = 'verified',
    updated_at = now()
from public.seller_profiles as seller
where seller.user_id = account.id
  and seller.verification_status = 'verified'::public.seller_status
  and seller.is_active = true
  and account.verification_status is distinct from 'verified';
