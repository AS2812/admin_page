-- migration.sql
-- 1. Enable PostGIS
create extension if not exists postgis;

-- 2. Enums (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname='verification_status') then
    create type verification_status as enum ('pending','approved','rejected');
  end if;
  if not exists (select 1 from pg_type where typname='authority_level') then
    create type authority_level as enum ('national','regional','local');
  end if;
  if not exists (select 1 from pg_type where typname='notification_type') then
    create type notification_type as enum ('system','report_update','alert');
  end if;
  if not exists (select 1 from pg_type where typname='notification_channel') then
    create type notification_channel as enum ('sms','email','push');
  end if;
  if not exists (select 1 from pg_type where typname='notification_delivery_status') then
    create type notification_delivery_status as enum ('pending','sent','delivered','failed');
  end if;
  if not exists (select 1 from pg_type where typname='report_dispatch_status') then
    create type report_dispatch_status as enum ('pending','notified','acknowledged','dismissed');
  end if;
  if not exists (select 1 from pg_type where typname='report_state') then
    create type report_state as enum ('submitted','reviewing','published','resolved','deleted');
  end if;
  if not exists (select 1 from pg_type where typname='report_priority') then
    create type report_priority as enum ('low','normal','high','critical');
  end if;
  if not exists (select 1 from pg_type where typname='notify_scope') then
    create type notify_scope as enum ('people','government','both');
  end if;
  if not exists (select 1 from pg_type where typname='map_view_mode') then
    create type map_view_mode as enum ('map','list','hybrid');
  end if;
  if not exists (select 1 from pg_type where typname='user_role') then
    create type user_role as enum ('user','moderator','dispatcher','admin');
  end if;
  if not exists (select 1 from pg_type where typname='account_status') then
    create type account_status as enum ('pending','active','suspended');
  end if;
end$$;

-- 3. Geometry/Geography columns
alter table public.alerts add column if not exists geom geography(Point,4326);
alter table public.authorities add column if not exists location_geog geography(Point,4326);
alter table public.reports add column if not exists location_geog geography(Point,4326);
alter table public.favorite_spots add column if not exists location_geog geography(Point,4326);

-- 4. Fix FKs on alerts
do $$
begin
  if exists (select 1 from information_schema.table_constraints where constraint_name like 'alerts_type_fk%') then
    alter table public.alerts drop constraint if exists alerts_type_fk1;
    alter table public.alerts drop constraint if exists alerts_type_fk2;
    alter table public.alerts drop constraint if exists alerts_type_fk3;
    alter table public.alerts drop constraint if exists alerts_type_fk4;
  end if;
end$$;

alter table public.alerts
  add constraint alerts_category_fk
  foreign key (category, subtype) references public.alert_types(category, subtype);

-- 5. Fix FKs on reports
alter table public.reports drop constraint if exists reports_subcategory_consistency;
alter table public.reports add constraint reports_category_fk foreign key (category_id) references public.report_categories(category_id);
alter table public.reports add constraint reports_subcategory_fk foreign key (subcategory_id) references public.report_subcategories(subcategory_id);

-- 6. Subcategory Consistency Trigger
create or replace function enforce_subcat_belongs_to_cat()
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
for each row execute function enforce_subcat_belongs_to_cat();

-- 7. Auth vs App Users: Ensure UUIDs and Joins
alter table public.users add column if not exists auth_user_id uuid unique;

-- 8. Helper Functions
create or replace function current_app_user_id() returns bigint
language sql stable as $$
  select u.user_id from public.users u
  where u.auth_user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable as $$ 
  select exists(select 1 from public.users u where u.auth_user_id = auth.uid() and u.role='admin')
$$;

create or replace function is_moderator() returns boolean
language sql stable as $$ 
  select exists(select 1 from public.users u where u.auth_user_id = auth.uid() and u.role='moderator')
$$;

create or replace function is_dispatcher() returns boolean
language sql stable as $$ 
  select exists(select 1 from public.users u where u.auth_user_id = auth.uid() and u.role='dispatcher')
$$;

-- 9. Updated_at Triggers
create or replace function set_updated_at() returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end; $$ language plpgsql;

-- Add triggers for tables with updated_at
-- Example for reports:
drop trigger if exists trg_set_updated_at_reports on public.reports;
create trigger trg_set_updated_at_reports before update on public.reports for each row execute function set_updated_at();
-- Repeat for other tables as needed

-- Enable RLS
alter table public.reports enable row level security;

-- Drop existing named policies to make this script idempotent
drop policy if exists insert_reports           on public.reports;
drop policy if exists select_reports           on public.reports;
drop policy if exists update_reports_owner     on public.reports;
drop policy if exists update_reports_admin     on public.reports;
drop policy if exists delete_reports_owner     on public.reports;
drop policy if exists delete_reports_admin     on public.reports;

create policy insert_reports on public.reports
  for insert to authenticated
  with check (user_id = current_app_user_id());
create policy select_reports on public.reports
  for select
  using (coalesce(status::text,'') <> 'deleted');
-- Update: owner or moderator/admin
create policy update_reports_owner on public.reports for update using (user_id = current_app_user_id());
create policy update_reports_admin on public.reports for update using (is_admin() or is_moderator());
-- Delete: owner or admin
create policy delete_reports_owner on public.reports for delete using (user_id = current_app_user_id());
create policy delete_reports_admin on public.reports for delete using (is_admin());

-- Repeat/adapt for report_media, user_devices, account_verifications, user_identity_documents, alerts, notifications, notification_deliveries, favorite_spots, etc.

-- 11. Storage Policies (buckets)
-- report-media: public read for thumbnails, owner/admin write
-- identity-docs: private, only owner/moderator/admin
-- public-assets: public read
-- (Emit storage.policies.sql separately)

-- 12. Views
create or replace view vw_reports_extended as
select r.*, c.name as category_name, s.name as subcategory_name, m.storage_url as cover_image_url,
  (r.created_at + interval '1 minute' * coalesce(r.ttl_minutes_override, c.default_ttl_minutes)) as expires_at
from public.reports r
left join public.report_categories c on r.category_id = c.category_id
left join public.report_subcategories s on r.subcategory_id = s.subcategory_id
left join lateral (
  select storage_url from public.report_media rm where rm.report_id = r.report_id and rm.is_cover limit 1
) m on true;

drop view if exists vw_users cascade;
create or replace view vw_users as
select
  u.*,
  a.email as auth_email,
  a.created_at as auth_created_at,
  p.gender,
  n.notifications_enabled,
  n.push_enabled,
  n.email_enabled,
  n.sms_enabled
from public.users u
left join auth.users                           a on a.id      = u.auth_user_id
left join public.user_profiles                 p on p.user_id = u.auth_user_id
left join public.user_notification_preferences n on n.user_id = u.user_id;

create or replace view vw_alerts_extended as
select a.*, t.default_ttl_minutes, t.ongoing_days
from public.alerts a
left join public.alert_types t on a.category = t.category and a.subtype = t.subtype;

-- 13. Seeds (categories, subcategories, alert_types, test users)
-- (Emit seeds.sql separately)

-- 14. Audit Events: ensure write-only from API
-- (Handled in API layer)

-- 15. Do not recreate spatial_ref_sys
-- (PostGIS extension handles this)

-- End migration.sql
