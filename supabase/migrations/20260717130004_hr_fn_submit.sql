-- HR module (slice 004), T018 — atomic request submit: hr_request insert + initial (null →
-- pending) status-history row in one write (data-model §5, US1). SECURITY INVOKER (default) so
-- the insert runs AS the calling `authenticated` role — `hr_request_insert_own` RLS
-- (20260717130003_hr_rls.sql) is the actual enforcement that centre_id/submitter_id match the
-- caller. Both are derived here from auth.jwt(), NEVER taken from a parameter, so nothing the
-- caller passes can cross a centre boundary or submit as someone else. Mirrors
-- create_task_with_log's shape (20260716120004_functions.sql).
--
-- US1 passes no cover_assignment rows — annual_leave is not yet resolved against the timetable.
-- US4 (T042) will `create or replace` this function to add cover_assignment inserts and set
-- status='awaiting_cover' for conflict-scoped types.

create or replace function public.create_hr_request_with_log(
  p_request_type text,
  p_start_date date default null,
  p_end_date date default null,
  p_day_part text default null,
  p_working_days numeric default null,
  p_amount numeric default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.hr_request
language plpgsql
as $$
declare
  v_request public.hr_request;
  v_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
begin
  insert into public.hr_request (
    request_type, submitter_id, centre_id, status, start_date, end_date, day_part,
    working_days, amount, payload
  )
  values (
    p_request_type, v_actor, v_centre, 'pending', p_start_date, p_end_date, p_day_part,
    p_working_days, p_amount, p_payload
  )
  returning * into v_request;

  insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by, reason)
  values (v_request.id, null, 'pending', v_actor, null);

  return v_request;
end;
$$;

grant execute on function public.create_hr_request_with_log(text, date, date, text, numeric, numeric, jsonb) to authenticated;
