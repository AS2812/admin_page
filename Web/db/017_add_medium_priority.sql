-- Add 'medium' to report_priority enum to resolve 22P02 errors
-- Some clients submit priority="medium"; this migration adds it to the type.

do $$ begin
  if exists (select 1 from pg_type where typname = 'report_priority') then
    -- Add the value if missing, positioned after 'normal' for logical ordering
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'report_priority' and e.enumlabel = 'medium'
    ) then
      alter type report_priority add value 'medium' after 'normal';
    end if;
  end if;
end $$;

-- Optional: If you prefer mapping 'medium' to existing 'normal',
-- adjust client code to send 'normal' instead of 'medium'.