-- Fast, transactional delete for reports and their dependents
-- This RPC is called by the privileged API to avoid multi-round trips
-- and potential foreign-key stalls when deleting a report.
--
-- Usage: select admin_delete_report(p_report_id := 123);

create or replace function public.admin_delete_report(p_report_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete child rows first to avoid FK blocking
  -- Feedback/comments attached to the report
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_feedbacks') then
    delete from public.report_feedbacks where report_id = p_report_id;
  end if;

  -- Authority dispatch records linked to the report
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_authority_dispatches') then
    delete from public.report_authority_dispatches where report_id = p_report_id;
  end if;

  -- Media attachments linked to the report
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_media') then
    delete from public.report_media where report_id = p_report_id;
  end if;

  -- Finally remove the report itself
  delete from public.reports where report_id = p_report_id;
end;
$$;

-- Notes:
-- - SECURITY DEFINER allows the function to bypass RLS using the owner privileges
--   (Supabase recommends creating RPCs for privileged workflows).
-- - This function intentionally performs explicit child deletes to avoid relying
--   on ON DELETE CASCADE across environments.

-- Allow authenticated clients to execute the RPC
grant execute on function public.admin_delete_report(bigint) to authenticated;