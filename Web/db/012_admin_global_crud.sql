-- Admin-wide CRUD policies for non-user tables
-- Goal: ensure admins have full CRUD over almost everything, while not
-- touching or changing any user-related policies (users, user_* tables).
--
-- Assumes public.is_admin() exists and returns true for current auth user
-- when they have role 'admin' in public.users.

-- Helper: safe enable RLS for a table if it exists
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='reports') then
    alter table public.reports enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_media') then
    alter table public.report_media enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_feedbacks') then
    alter table public.report_feedbacks enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_authority_dispatches') then
    alter table public.report_authority_dispatches enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_categories') then
    alter table public.report_categories enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_subcategories') then
    alter table public.report_subcategories enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alerts') then
    alter table public.alerts enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alert_types') then
    alter table public.alert_types enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='authorities') then
    alter table public.authorities enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='authority_categories') then
    alter table public.authority_categories enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications') then
    alter table public.notifications enable row level security;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notification_deliveries') then
    alter table public.notification_deliveries enable row level security;
  end if;
end $$;

-- Admin CRUD: create a single admin policy per table (“for all”) and leave existing
-- user-scoped policies intact. We use distinct policy names so they can coexist.

-- reports
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='reports') then
    drop policy if exists reports_admin_all on public.reports;
    create policy reports_admin_all on public.reports
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_media
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_media') then
    drop policy if exists report_media_admin_all on public.report_media;
    create policy report_media_admin_all on public.report_media
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_feedbacks
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_feedbacks') then
    drop policy if exists report_feedbacks_admin_all on public.report_feedbacks;
    create policy report_feedbacks_admin_all on public.report_feedbacks
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_authority_dispatches
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_authority_dispatches') then
    drop policy if exists dispatches_admin_all on public.report_authority_dispatches;
    create policy dispatches_admin_all on public.report_authority_dispatches
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_categories
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_categories') then
    drop policy if exists report_categories_admin_all on public.report_categories;
    create policy report_categories_admin_all on public.report_categories
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- report_subcategories
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_subcategories') then
    drop policy if exists report_subcategories_admin_all on public.report_subcategories;
    create policy report_subcategories_admin_all on public.report_subcategories
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- alerts
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alerts') then
    drop policy if exists alerts_admin_all on public.alerts;
    create policy alerts_admin_all on public.alerts
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- alert_types
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alert_types') then
    drop policy if exists alert_types_admin_all on public.alert_types;
    create policy alert_types_admin_all on public.alert_types
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- authorities
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='authorities') then
    drop policy if exists authorities_admin_all on public.authorities;
    create policy authorities_admin_all on public.authorities
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- authority_categories
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='authority_categories') then
    drop policy if exists authority_categories_admin_all on public.authority_categories;
    create policy authority_categories_admin_all on public.authority_categories
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- notifications
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications') then
    drop policy if exists notifications_admin_all on public.notifications;
    create policy notifications_admin_all on public.notifications
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- notification_deliveries
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notification_deliveries') then
    drop policy if exists notification_deliveries_admin_all on public.notification_deliveries;
    create policy notification_deliveries_admin_all on public.notification_deliveries
      for all
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- IMPORTANT: This migration intentionally DOES NOT touch user-related tables or policies:
-- users, user_devices, user_identity_documents, user_map_preferences, user_sessions,
-- user_profiles, user_notification_preferences, user_category_filters, favorite_spots,
-- account_verifications, and any other tables prefixed with user_.
-- Existing policies for those remain as-is.