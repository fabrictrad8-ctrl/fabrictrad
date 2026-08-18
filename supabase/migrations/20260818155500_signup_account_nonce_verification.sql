create or replace function public.get_signup_account_by_nonce(
  p_user_id uuid,
  p_nonce text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth auth.users%rowtype;
  v_profile public.user_profiles%rowtype;
  v_buyer_id uuid;
  v_seller_id uuid;
begin
  if p_user_id is null or length(trim(coalesce(p_nonce, ''))) < 20 then
    raise exception 'Registration verification expired or invalid.' using errcode = '42501';
  end if;

  select * into v_auth
  from auth.users
  where id = p_user_id
    and created_at > now() - interval '2 hours'
    and raw_user_meta_data->>'registration_nonce' = trim(p_nonce);

  if not found then
    raise exception 'Registration verification expired or invalid.' using errcode = '42501';
  end if;

  select * into v_profile
  from public.user_profiles
  where id = p_user_id;

  if not found then
    raise exception 'Account profile is not ready.' using errcode = 'P0002';
  end if;

  select id into v_buyer_id
  from public.buyer_profiles
  where user_id = p_user_id
  limit 1;

  if coalesce(v_profile.can_sell, false) then
    select id into v_seller_id
    from public.seller_profiles
    where user_id = p_user_id
    limit 1;
  end if;

  return jsonb_build_object(
    'ready', true,
    'role', v_profile.role::text,
    'userProfileId', v_profile.id,
    'buyerProfileId', v_buyer_id,
    'sellerProfileId', v_seller_id,
    'canBuy', coalesce(v_profile.can_buy, true),
    'canSell', coalesce(v_profile.can_sell, false),
    'phonePresent', nullif(regexp_replace(coalesce(v_profile.phone, ''), '[^0-9]', '', 'g'), '') is not null
  );
end;
$function$;

revoke all on function public.get_signup_account_by_nonce(uuid, text) from public;
grant execute on function public.get_signup_account_by_nonce(uuid, text) to anon, authenticated;
