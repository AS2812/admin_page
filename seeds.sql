-- seeds.sql
-- Categories
insert into public.report_categories (category_id, name, slug, default_ttl_minutes) values
  (1, 'Safety', 'safety', 120),
  (2, 'Health', 'health', 180)
  on conflict do nothing;

-- Subcategories
insert into public.report_subcategories (subcategory_id, category_id, name, slug) values
  (1, 1, 'Fire', 'fire'),
  (2, 1, 'Accident', 'accident'),
  (3, 2, 'Injury', 'injury')
  on conflict do nothing;

-- Alert Types
insert into public.alert_types (category, subtype, default_ttl_minutes, ongoing_days) values
  ('Safety', 'Fire', 60, 2),
  ('Health', 'Injury', 120, 1)
  on conflict do nothing;

-- Test Users (admin, moderator, dispatcher, user)
insert into public.users (user_id, auth_user_id, role, account_status) values
  (1001, '00000000-0000-0000-0000-000000000001', 'admin', 'active'),
  (1002, '00000000-0000-0000-0000-000000000002', 'moderator', 'active'),
  (1003, '00000000-0000-0000-0000-000000000003', 'dispatcher', 'active'),
  (1004, '00000000-0000-0000-0000-000000000004', 'user', 'active')
  on conflict do nothing;

-- Add corresponding auth.users and user_profiles as needed
-- (You may need to insert into auth.users via Supabase dashboard or admin API)

-- End seeds.sql
