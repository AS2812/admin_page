-- RLS policies: admins have full CRUD; regular users have read-only access
-- This migration assumes a `users` table with `auth_user_id` and `role` columns,
-- and app tables: `reports`, `report_media`, `report_categories`, `report_subcategories`,
-- and `report_authority_dispatches`.

-- Helper: determine if current auth user is an admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'admin'
  );
$$;

-- USERS table: admins full CRUD; users can read their own row
alter table if exists public.users enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select
  using (
    public.is_admin() or auth.uid() = public.users.auth_user_id
  );

drop policy if exists users_crud_admin on public.users;
create policy users_crud_admin on public.users
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- REPORTS: readable by all authenticated; writable only by admins
alter table if exists public.reports enable row level security;

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select
  using (true);

drop policy if exists reports_crud_admin on public.reports;
create policy reports_crud_admin on public.reports
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- REPORT_MEDIA: readable by all authenticated; writable only by admins
alter table if exists public.report_media enable row level security;

drop policy if exists report_media_select on public.report_media;
create policy report_media_select on public.report_media
  for select
  using (true);

drop policy if exists report_media_crud_admin on public.report_media;
create policy report_media_crud_admin on public.report_media
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- REPORT_CATEGORIES: readable by all; writable only by admins
alter table if exists public.report_categories enable row level security;

drop policy if exists report_categories_select on public.report_categories;
create policy report_categories_select on public.report_categories
  for select
  using (true);

drop policy if exists report_categories_crud_admin on public.report_categories;
create policy report_categories_crud_admin on public.report_categories
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- REPORT_SUBCATEGORIES: readable by all; writable only by admins
alter table if exists public.report_subcategories enable row level security;

drop policy if exists report_subcategories_select on public.report_subcategories;
create policy report_subcategories_select on public.report_subcategories
  for select
  using (true);

drop policy if exists report_subcategories_crud_admin on public.report_subcategories;
create policy report_subcategories_crud_admin on public.report_subcategories
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- REPORT_AUTHORITY_DISPATCHES: readable by all; writable only by admins
alter table if exists public.report_authority_dispatches enable row level security;

drop policy if exists dispatches_select on public.report_authority_dispatches;
create policy dispatches_select on public.report_authority_dispatches
  for select
  using (true);

drop policy if exists dispatches_crud_admin on public.report_authority_dispatches;
create policy dispatches_crud_admin on public.report_authority_dispatches
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Recommended grants (Supabase manages role grants automatically); kept here for clarity
-- grant usage on function public.is_admin() to public;