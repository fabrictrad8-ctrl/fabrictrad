create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  link_label text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.site_announcements enable row level security;

create policy anyone_read_active_announcements on public.site_announcements
  for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy admin_full_access_announcements on public.site_announcements
  for all
  using (is_admin())
  with check (is_admin());
