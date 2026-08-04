drop policy if exists "seller_own_or_admin" on public.seller_registrations;
create policy "seller_own_or_admin"
on public.seller_registrations
for all
to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

create or replace function public.protect_seller_registration_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.gstin_verified is distinct from old.gstin_verified
     or new.gstin_verified_at is distinct from old.gstin_verified_at
     or new.bank_verified is distinct from old.bank_verified
     or new.bank_verified_at is distinct from old.bank_verified_at
     or new.razorpay_linked_account_id is distinct from old.razorpay_linked_account_id
     or new.registration_status is distinct from old.registration_status
     or new.rejection_reason is distinct from old.rejection_reason
     or new.approved_at is distinct from old.approved_at then
    raise exception 'Seller application review fields are managed by FabricTrad.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_seller_registration_review_fields_trigger on public.seller_registrations;
create trigger protect_seller_registration_review_fields_trigger
before update on public.seller_registrations
for each row execute function public.protect_seller_registration_review_fields();
