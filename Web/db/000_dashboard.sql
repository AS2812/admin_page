-- Enable PostGIS
create extension if not exists postgis;

-- Enums (create if missing)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type verification_status as enum ('pending','approved','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'authority_level') then
    create type authority_level as enum ('national','regional','local');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum ('system','report_update','alert');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type notification_channel as enum ('sms','email','push');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_delivery_status') then
    create type notification_delivery_status as enum ('pending','sent','delivered','failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_dispatch_status') then
    create type report_dispatch_status as enum ('pending','notified','acknowledged','dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_state') then
    create type report_state as enum ('submitted','reviewing','published','resolved','deleted');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_priority') then
    create type report_priority as enum ('low','normal','high','critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'notify_scope') then
    create type notify_scope as enum ('people','government','both');
  end if;
  if not exists (select 1 from pg_type where typname = 'map_view_mode') then
    create type map_view_mode as enum ('map','list','hybrid');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user','moderator','dispatcher','admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum ('pending','active','suspended');
  end if;
end $$;

-- Geography/Geometry columns
alter table if exists public.alerts add column if not exists geom geography(Point,4326);
alter table if exists public.authorities add column if not exists location_geog geography(Point,4326);
alter table if exists public.reports add column if not exists location_geog geography(Point,4326);
alter table if exists public.favorite_spots add column if not exists location_geog geography(Point,4326);

-- Fix alerts FKs: ensure (category, subtype) references alert_types(category, subtype)
do $$ begin
  if exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='alerts' and constraint_name like 'alerts_type_fk%'
  ) then
    -- drop conflicting constraints
    execute (
      select string_agg('alter table public.alerts drop constraint ' || quote_ident(tc.constraint_name), '; ')
      from information_schema.table_constraints tc
      where tc.table_schema='public' and tc.table_name='alerts' and tc.constraint_name like 'alerts_type_fk%'
    );
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='alerts' and constraint_name='alerts_category_fk'
  ) then
    alter table public.alerts
      add constraint alerts_category_fk
      foreign key (category, subtype) references public.alert_types(category, subtype);
  end if;
end $$;

-- Fix reports FKs
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='reports' and constraint_name='reports_category_fk'
  ) then
    alter table public.reports
      add constraint reports_category_fk
      foreign key (category_id) references public.report_categories(category_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='reports' and constraint_name='reports_subcategory_fk'
  ) then
    alter table public.reports
      add constraint reports_subcategory_fk
      foreign key (subcategory_id) references public.report_subcategories(subcategory_id);
  end if;
end $$;

-- Consistency trigger: subcategory belongs to category
create or replace function public.enforce_subcat_belongs_to_cat()
returns trigger language plpgsql as $$
begin
  if NEW.subcategory_id is not null then
    if not exists (
      select 1 from public.report_subcategories s
      where s.subcategory_id = NEW.subcategory_id and s.category_id = NEW.category_id
    ) then
      raise exception 'subcategory % does not belong to category %', NEW.subcategory_id, NEW.category_id;
    end if;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_reports_subcat_consistency on public.reports;
create trigger trg_reports_subcat_consistency
before insert or update on public.reports
for each row execute function public.enforce_subcat_belongs_to_cat();

-- Timestamp updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end; $$;

-- Apply updated_at triggers to known tables if column exists
do $$ declare r record; begin
  for r in select table_schema, table_name from information_schema.columns 
           where column_name='updated_at' and table_schema='public'
  loop
    execute format('drop trigger if exists set_updated_at on %I.%I', r.table_schema, r.table_name);
    execute format('create trigger set_updated_at before update on %I.%I for each row execute function public.set_updated_at()', r.table_schema, r.table_name);
  end loop;
end $$;

-- Helpers to map auth.uid() to app user and roles
create or replace function public.current_app_user_id() returns bigint
language sql stable as $$
  select u.user_id from public.users u where u.auth_user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(select 1 from public.users u where u.auth_user_id = auth.uid() and u.role = 'admin')
$$;
create or replace function public.is_moderator() returns boolean
language sql stable as $$
  select exists(select 1 from public.users u where u.auth_user_id = auth.uid() and u.role = 'moderator')
$$;
create or replace function public.is_dispatcher() returns boolean
language sql stable as $$
  select exists(select 1 from public.users u where u.auth_user_id = auth.uid() and u.role = 'dispatcher')
$$;

-- RLS enable on user-facing tables (skip if table missing)
do $$ begin
  perform 1 from information_schema.tables where table_schema='public' and table_name='reports';
  if found then alter table public.reports enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='report_media';
  if found then alter table public.report_media enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='favorite_spots';
  if found then alter table public.favorite_spots enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='user_devices';
  if found then alter table public.user_devices enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='account_verifications';
  if found then alter table public.account_verifications enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='user_identity_documents';
  if found then alter table public.user_identity_documents enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='alerts';
  if found then alter table public.alerts enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='notifications';
  if found then alter table public.notifications enable row level security; end if;
  perform 1 from information_schema.tables where table_schema='public' and table_name='notification_deliveries';
  if found then alter table public.notification_deliveries enable row level security; end if;
end $$;

-- Policies (guard with table existence)
-- reports
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='reports') then
    drop policy if exists reports_read on public.reports;
    drop policy if exists reports_insert on public.reports;
    drop policy if exists reports_update on public.reports;
    drop policy if exists reports_delete on public.reports;

    create policy reports_read on public.reports for select
      using (deleted_at is null);

    create policy reports_insert on public.reports for insert
      with check (auth.uid() is not null and user_id = public.current_app_user_id());

    create policy reports_update on public.reports for update
      using (
        (user_id = public.current_app_user_id())
        or public.is_moderator() or public.is_admin()
      );

    create policy reports_delete on public.reports for delete
      using (
        (user_id = public.current_app_user_id())
        or public.is_admin()
      );
  end if;
end $$;

-- report_media
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_media') then
    drop policy if exists report_media_read on public.report_media;
    drop policy if exists report_media_write on public.report_media;
    create policy report_media_read on public.report_media for select using (true);
    create policy report_media_write on public.report_media for all using (
      exists (select 1 from public.reports r where r.id = report_id and (
        r.user_id = public.current_app_user_id() or public.is_admin()
      ))
    );
  end if;
end $$;

-- user_devices
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_devices') then
    drop policy if exists user_devices_self on public.user_devices;
    drop policy if exists user_devices_admin_read on public.user_devices;
    create policy user_devices_self on public.user_devices for all using (user_id = auth.uid());
    create policy user_devices_admin_read on public.user_devices for select using (public.is_admin());
  end if;
end $$;

-- account_verifications & user_identity_documents
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='account_verifications') then
    drop policy if exists acct_verif_self on public.account_verifications;
    drop policy if exists acct_verif_mod on public.account_verifications;
    create policy acct_verif_self on public.account_verifications for all using (user_id = public.current_app_user_id());
    create policy acct_verif_mod on public.account_verifications for all using (public.is_moderator() or public.is_admin());
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_identity_documents') then
    drop policy if exists uid_self on public.user_identity_documents;
    drop policy if exists uid_mod on public.user_identity_documents;
    create policy uid_self on public.user_identity_documents for all using (user_id = public.current_app_user_id());
    create policy uid_mod on public.user_identity_documents for all using (public.is_moderator() or public.is_admin());
  end if;
end $$;

-- alerts (write: moderators/dispatchers/admins; read: all)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='alerts') then
    drop policy if exists alerts_read on public.alerts;
    drop policy if exists alerts_write on public.alerts;
    create policy alerts_read on public.alerts for select using (true);
    create policy alerts_write on public.alerts for all using (public.is_moderator() or public.is_dispatcher() or public.is_admin());
  end if;
end $$;

-- notifications & deliveries
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications') then
    drop policy if exists noti_read on public.notifications;
    drop policy if exists noti_admin on public.notifications;
    create policy noti_read on public.notifications for select using (recipient_auth_user_id = auth.uid());
    create policy noti_admin on public.notifications for all using (public.is_admin());
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notification_deliveries') then
    drop policy if exists deliv_read on public.notification_deliveries;
    drop policy if exists deliv_admin on public.notification_deliveries;
    create policy deliv_read on public.notification_deliveries for select using (recipient_auth_user_id = auth.uid());
    create policy deliv_admin on public.notification_deliveries for all using (public.is_admin());
  end if;
end $$;

-- Views
create or replace view public.vw_users as
  select u.user_id,
         u.auth_user_id,
         u.role,
         u.account_status,
         p.gender,
         n.* as notification_prefs
  from public.users u
  left join public.user_profiles p on p.user_id = u.user_id
  left join public.user_notification_preferences n on n.user_id = u.user_id;

create or replace view public.vw_alerts_extended as
  select a.*, t.default_ttl_minutes, t.ongoing_days
  from public.alerts a
  left join public.alert_types t on t.category = a.category and t.subtype = a.subtype;

create or replace view public.vw_reports_extended as
  select r.*, c.name as category_name, s.name as subcategory_name
  from public.reports r
  left join public.report_categories c on c.category_id = r.category_id
  left join public.report_subcategories s on s.subcategory_id = r.subcategory_id;


