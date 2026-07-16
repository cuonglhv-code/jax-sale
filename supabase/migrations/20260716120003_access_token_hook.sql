-- Custom Access Token Auth Hook (research R1). Injects app_role / centre_id / employee_id as
-- top-level JWT claims at token issuance so RLS reads them directly (auth.jwt() ->> 'centre_id')
-- with no per-row join. NOT security definer — instead granted explicitly to supabase_auth_admin.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  emp record;
begin
  select e.app_role, e.centre_id, e.id as employee_id, e.is_active
    into emp
    from public.employees e
    where e.auth_user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if emp.app_role is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(emp.app_role));
    claims := jsonb_set(claims, '{centre_id}', to_jsonb(emp.centre_id::text));
    claims := jsonb_set(claims, '{employee_id}', to_jsonb(emp.employee_id::text));
    claims := jsonb_set(claims, '{is_active}', to_jsonb(emp.is_active));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- The hook runs as supabase_auth_admin; grant exactly what it needs, revoke from everyone else.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Let the hook read the employees table it resolves claims from.
grant select on public.employees to supabase_auth_admin;
create policy "employees_authadmin_read" on public.employees
  for select to supabase_auth_admin using (true);
