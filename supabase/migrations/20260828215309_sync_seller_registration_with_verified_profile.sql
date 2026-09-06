create or replace function public.sync_verified_seller_account_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform set_config('fabrictrad.trusted_capability_change', '1', true);

  update public.user_profiles
     set role = 'buyer'::public.user_role,
         can_buy = true,
         can_sell = (new.verification_status = 'verified'::public.seller_status and new.is_active = true),
         verification_status = case
           when new.verification_status = 'verified'::public.seller_status and new.is_active = true then 'verified'
           when new.verification_status in ('rejected'::public.seller_status, 'suspended'::public.seller_status, 'permanently_blocked'::public.seller_status) then new.verification_status::text
           else 'pending'
         end,
         updated_at = now()
   where id = new.user_id
     and role not in ('super_admin'::public.user_role, 'admin_staff'::public.user_role);

  update public.buyer_profiles
     set is_active = true,
         updated_at = now()
   where user_id = new.user_id;

  if new.verification_status = 'verified'::public.seller_status and new.is_active = true then
    update public.seller_registrations
       set registration_status = 'approved',
           rejection_reason = null,
           approved_at = coalesce(approved_at, now()),
           updated_at = now()
     where user_id = new.user_id
       and registration_status is distinct from 'approved';
  elsif new.verification_status = 'rejected'::public.seller_status then
    update public.seller_registrations
       set registration_status = 'rejected',
           approved_at = null,
           updated_at = now()
     where user_id = new.user_id
       and registration_status is distinct from 'rejected';
  end if;

  return new;
end;
$function$;

update public.seller_registrations sr
set registration_status='approved',
    rejection_reason=null,
    approved_at=coalesce(sr.approved_at,now()),
    updated_at=now()
from public.seller_profiles sp
where sr.user_id=sp.user_id
  and sp.verification_status='verified'::public.seller_status
  and sp.is_active=true
  and sr.registration_status is distinct from 'approved';

update public.seller_registrations sr
set registration_status='rejected',
    approved_at=null,
    updated_at=now()
from public.seller_profiles sp
where sr.user_id=sp.user_id
  and sp.verification_status='rejected'::public.seller_status
  and sr.registration_status is distinct from 'rejected';
