-- Enable Realtime for alerts and reports (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname='supabase_realtime'
  ) then
    execute 'create publication supabase_realtime with (publish = ''insert, update, delete'')';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='alerts'
  ) then
    execute 'alter publication supabase_realtime add table public.alerts';
  end if;
  execute 'alter table public.alerts replica identity full';

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='reports'
  ) then
    execute 'alter publication supabase_realtime add table public.reports';
  end if;
  execute 'alter table public.reports replica identity full';
end$$;

