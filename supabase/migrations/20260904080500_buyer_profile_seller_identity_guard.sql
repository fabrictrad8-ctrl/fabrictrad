-- Prevent later buyer/account profile edits from colliding with active seller identity fields.

create or replace function public.enforce_user_profile_seller_identity_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare conflict_field text;
begin
  if coalesce(new.is_active,true)=false then return new; end if;
  if not exists (
    select 1 from public.buyer_profiles bp
    where bp.user_id=new.id and coalesce(bp.is_active,true)=true
  ) then return new; end if;

  select case
    when sp.contact_name is not null and lower(trim(sp.contact_name))=lower(trim(coalesce(new.full_name,''))) then 'name'
    when sp.contact_email is not null and lower(trim(sp.contact_email))=lower(trim(coalesce(new.email,''))) then 'email'
    when sp.contact_phone is not null and right(regexp_replace(sp.contact_phone,'[^0-9]','','g'),10)=right(regexp_replace(coalesce(new.phone,''),'[^0-9]','','g'),10) then 'phone'
    when sp.whatsapp_no is not null and right(regexp_replace(sp.whatsapp_no,'[^0-9]','','g'),10)=right(regexp_replace(coalesce(new.phone,''),'[^0-9]','','g'),10) then 'whatsapp'
    else null end
  into conflict_field
  from public.seller_profiles sp
  where coalesce(sp.is_active,true)=true and (
    (sp.contact_name is not null and lower(trim(sp.contact_name))=lower(trim(coalesce(new.full_name,''))))
    or (sp.contact_email is not null and lower(trim(sp.contact_email))=lower(trim(coalesce(new.email,''))))
    or (sp.contact_phone is not null and right(regexp_replace(sp.contact_phone,'[^0-9]','','g'),10)=right(regexp_replace(coalesce(new.phone,''),'[^0-9]','','g'),10))
    or (sp.whatsapp_no is not null and right(regexp_replace(sp.whatsapp_no,'[^0-9]','','g'),10)=right(regexp_replace(coalesce(new.phone,''),'[^0-9]','','g'),10))
  )
  limit 1;

  if conflict_field is not null then
    raise exception 'BUYER_SELLER_IDENTITY_CONFLICT:%', conflict_field using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_profile_seller_identity_separation on public.user_profiles;
create trigger trg_user_profile_seller_identity_separation
before update of full_name,email,phone,is_active
on public.user_profiles
for each row execute function public.enforce_user_profile_seller_identity_separation();
