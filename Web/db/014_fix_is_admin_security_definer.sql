-- Fix admin role resolution: make helper functions SECURITY DEFINER
-- so they can read public.users regardless of RLS, and ensure the
-- search_path is set properly.

-- is_admin(): returns true if current auth user has role 'admin'
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid()
      and u.role = 'admin'
  );
$$;

-- current_app_user_id(): map auth.uid() to app user_id
create or replace function public.current_app_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.user_id from public.users u where u.auth_user_id = auth.uid();
$$;

-- Optional: allow authenticated role to execute these helper functions
do $$ begin
  -- In many setups function execution is open, but we grant explicitly
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.is_admin() to authenticated;
    grant execute on function public.current_app_user_id() to authenticated;
  end if;
end $$;