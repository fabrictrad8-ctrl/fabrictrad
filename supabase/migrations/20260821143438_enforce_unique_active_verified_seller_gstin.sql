create unique index if not exists seller_profiles_one_active_verified_gstin_idx
on public.seller_profiles ((upper(btrim(gstin))))
where nullif(btrim(gstin), '') is not null
  and is_active = true
  and gstin_verified = true
  and verification_status = 'verified'::public.seller_status;
