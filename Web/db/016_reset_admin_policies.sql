-- Reset and recreate admin functions and RLS policies
-- Drops conflicting/duplicate policies and re‑applies a single, consistent set.

-- 1) Recreate helper functions with SECURITY DEFINER and stable search_path
create or replace function public.current_app_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.user_id from public.users u where u.auth_user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'admin'
  );
$$;

-- 2) Drop all existing policies on targeted non‑user tables to avoid conflicts
do $$
declare t record; p record; begin
  for t in (
    select unnest(array[
      'reports', 'report_media', 'report_feedbacks', 'report_authority_dispatches',
      'report_categories', 'report_subcategories', 'alerts', 'alert_types',
      'authorities', 'authority_categories', 'notifications', 'notification_deliveries'
    ]) as table_name
  ) loop
    if exists (
      select 1 from information_schema.tables
      where table_schema='public' and table_name=t.table_name
    ) then
      for p in (
        select polname from pg_policies
        where schemaname='public' and tablename=t.table_name
      ) loop
        execute format('drop policy %I on public.%I', p.polname, t.table_name);
      end loop;
      execute format('alter table public.%I enable row level security', t.table_name);
    end if;
  end loop;
end $$;

-- 3) Recreate consistent policies bound to role 'authenticated'

-- reports: readable when not soft‑deleted, insert by owner, admin has full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='reports') then
    create policy reports_select on public.reports
      for select
      to authenticated
      using (deleted_at is null);

    create policy reports_insert_owner on public.reports
      for insert
      to authenticated
      with check (auth.uid() is not null and user_id = public.current_app_user_id());

    create policy reports_update_owner_or_admin on public.reports
      for update
      to authenticated
      using (user_id = public.current_app_user_id() or public.is_admin())
      with check (user_id = public.current_app_user_id() or public.is_admin());

    create policy reports_delete_owner_or_admin on public.reports
      for delete
      to authenticated
      using (user_id = public.current_app_user_id() or public.is_admin());

    -- Explicit admin‑all for clarity (covers insert/update/delete/select)
    create policy reports_admin_all on public.reports
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_media: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_media') then
    create policy report_media_select on public.report_media
      for select
      to authenticated
      using (true);
    create policy report_media_admin_all on public.report_media
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_feedbacks: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_feedbacks') then
    create policy report_feedbacks_select on public.report_feedbacks
      for select
      to authenticated
      using (true);
    create policy report_feedbacks_admin_all on public.report_feedbacks
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_authority_dispatches: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_authority_dispatches') then
    create policy dispatches_select on public.report_authority_dispatches
      for select
      to authenticated
      using (true);
    create policy dispatches_admin_all on public.report_authority_dispatches
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_categories: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_categories') then
    create policy report_categories_select on public.report_categories
      for select
      to authenticated
      using (true);
    create policy report_categories_admin_all on public.report_categories
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_subcategories: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_subcategories') then
    create policy report_subcategories_select on public.report_subcategories
      for select
      to authenticated
      using (true);
    create policy report_subcategories_admin_all on public.report_subcategories
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- alerts: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alerts') then
    create policy alerts_select on public.alerts
      for select
      to authenticated
      using (true);
    create policy alerts_admin_all on public.alerts
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- alert_types: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alert_types') then
    create policy alert_types_select on public.alert_types
      for select
      to authenticated
      using (true);
    create policy alert_types_admin_all on public.alert_types
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- authorities: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='authorities') then
    create policy authorities_select on public.authorities
      for select
      to authenticated
      using (true);
    create policy authorities_admin_all on public.authorities
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- authority_categories: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='authority_categories') then
    create policy authority_categories_select on public.authority_categories
      for select
      to authenticated
      using (true);
    create policy authority_categories_admin_all on public.authority_categories
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- notifications: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications') then
    create policy notifications_select on public.notifications
      for select
      to authenticated
      using (true);
    create policy notifications_admin_all on public.notifications
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- notification_deliveries: readable by authenticated; admin full CRUD
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notification_deliveries') then
    create policy notification_deliveries_select on public.notification_deliveries
      for select
      to authenticated
      using (true);
    create policy notification_deliveries_admin_all on public.notification_deliveries
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Notes:
-- - This migration standardizes admin policies and makes helper functions robust
--   under RLS via SECURITY DEFINER with search_path set to public.
-- - Users table policies are intentionally left untouched.