-- Explicit privileges for authenticated role on public.reports
-- Fixes 42501 permission denied by ensuring base table privileges
-- are granted before RLS policies are evaluated.

do $$ begin
  -- Ensure schema usage (harmless if already granted)
  execute 'grant usage on schema public to authenticated';
exception when others then null; end $$;

do $$ begin
  -- Grant CRUD privileges on reports to authenticated
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='reports'
  ) then
    grant select, insert, update, delete on table public.reports to authenticated;
  end if;
end $$;

-- Optional: if soft-delete uses a sequence/defaults, grant usage on sequences
do $$ declare s record; begin
  for s in
    select sequence_schema, sequence_name
    from information_schema.sequences
    where sequence_schema='public' and sequence_name in (
      -- include common sequences if present; safe if none exist
      'reports_report_id_seq'
    )
  loop
    execute format('grant usage on sequence %I.%I to authenticated', s.sequence_schema, s.sequence_name);
  end loop;
exception when others then null; end $$;

-- Notes:
-- - Postgres checks privileges before RLS. Without table grants, RLS policies
--   never run and you get 42501 even if policies allow the action.
-- - Supabase typically manages grants, but custom tables/policies can miss them;
--   this migration makes the grants explicit for reports.