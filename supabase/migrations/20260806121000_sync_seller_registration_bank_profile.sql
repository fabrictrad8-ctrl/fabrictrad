-- Keep the seller registration form and the settlement profile in sync.
-- request_seller_access stores masked bank details on seller_registrations, while
-- verification readiness checks seller_bank_profiles. Without this bridge a
-- correctly completed application can remain stuck at "bank details missing".

create unique index if not exists seller_bank_profiles_one_per_seller_idx
  on public.seller_bank_profiles (seller_id);

create or replace function public.sync_seller_registration_bank_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_profile_id uuid;
  v_account_mask text;
  v_details_changed boolean := true;
begin
  if nullif(btrim(coalesce(new.bank_account_number, '')), '') is null
     or nullif(btrim(coalesce(new.bank_ifsc, '')), '') is null
     or nullif(btrim(coalesce(new.bank_account_name, '')), '') is null
     or nullif(btrim(coalesce(new.bank_name, '')), '') is null then
    return new;
  end if;

  select seller.id
    into v_seller_profile_id
  from public.seller_profiles seller
  where seller.user_id = new.user_id
  order by seller.created_at desc
  limit 1;

  if v_seller_profile_id is null then
    return new;
  end if;

  v_account_mask := case
    when new.bank_account_number like '****%' then new.bank_account_number
    else '****' || right(regexp_replace(new.bank_account_number, '\D', '', 'g'), 4)
  end;

  if tg_op = 'UPDATE' then
    v_details_changed :=
      old.bank_account_number is distinct from new.bank_account_number
      or old.bank_ifsc is distinct from new.bank_ifsc
      or old.bank_account_name is distinct from new.bank_account_name
      or old.bank_name is distinct from new.bank_name;
  end if;

  insert into public.seller_bank_profiles (
    seller_id,
    account_holder_name,
    bank_name,
    account_number_masked,
    ifsc_code,
    account_type,
    is_verified,
    updated_at
  ) values (
    v_seller_profile_id,
    btrim(new.bank_account_name),
    btrim(new.bank_name),
    v_account_mask,
    upper(btrim(new.bank_ifsc)),
    'current',
    false,
    now()
  )
  on conflict (seller_id) do update
  set account_holder_name = excluded.account_holder_name,
      bank_name = excluded.bank_name,
      account_number_masked = excluded.account_number_masked,
      ifsc_code = excluded.ifsc_code,
      account_type = excluded.account_type,
      is_verified = case
        when v_details_changed then false
        else public.seller_bank_profiles.is_verified
      end,
      updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_seller_registration_bank_profile() from public, anon, authenticated;

drop trigger if exists seller_registration_sync_bank_profile on public.seller_registrations;
create trigger seller_registration_sync_bank_profile
after insert or update of bank_account_number, bank_ifsc, bank_account_name, bank_name
on public.seller_registrations
for each row
execute function public.sync_seller_registration_bank_profile();

-- Repair any previously submitted application that already contains bank data.
insert into public.seller_bank_profiles (
  seller_id,
  account_holder_name,
  bank_name,
  account_number_masked,
  ifsc_code,
  account_type,
  is_verified,
  updated_at
)
select
  seller.id,
  btrim(registration.bank_account_name),
  btrim(registration.bank_name),
  case
    when registration.bank_account_number like '****%' then registration.bank_account_number
    else '****' || right(regexp_replace(registration.bank_account_number, '\D', '', 'g'), 4)
  end,
  upper(btrim(registration.bank_ifsc)),
  'current',
  false,
  now()
from public.seller_registrations registration
join public.seller_profiles seller on seller.user_id = registration.user_id
where nullif(btrim(coalesce(registration.bank_account_number, '')), '') is not null
  and nullif(btrim(coalesce(registration.bank_ifsc, '')), '') is not null
  and nullif(btrim(coalesce(registration.bank_account_name, '')), '') is not null
  and nullif(btrim(coalesce(registration.bank_name, '')), '') is not null
on conflict (seller_id) do nothing;
