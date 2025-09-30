-- Ensure admin CRUD on public.reports applies cleanly to authenticated clients
-- This hardening migration recreates the admin policy explicitly for the
-- 'authenticated' role, to avoid ambiguity and fix permission errors.

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='reports') then
    alter table public.reports enable row level security;

    drop policy if exists reports_admin_all on public.reports;
    create policy reports_admin_all on public.reports
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Notes:
-- - Supabase routes logged-in client queries under role 'authenticated'.
-- - The is_admin() function must resolve based on auth.uid() mapping in public.users.
-- - If you still see 42501, verify your session user has a row in public.users
--   with role='admin' and matching auth_user_id.