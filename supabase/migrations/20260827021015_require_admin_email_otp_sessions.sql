create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)
      and lower(coalesce(auth.jwt()->>'email', '')) = 'fabrictrad8@gmail.com'
      and exists (
        select 1
        from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) entry
        where entry->>'method' in ('otp', 'magiclink')
      )
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.is_admin_otp_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin();
$$;

revoke all on function public.is_admin_otp_session() from public, anon;
grant execute on function public.is_admin_otp_session() to authenticated, service_role;
