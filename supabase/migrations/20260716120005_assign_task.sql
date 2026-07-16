-- Guarded task reassignment (spec FR-019, contracts/tasks.actions.md `assignTask`). Same-centre-only
-- by design (§12 deliberate limitation): the new assignee must be an active employee of the SAME
-- centre as the task itself. SECURITY INVOKER (default) — RLS still confines the caller to their
-- own centre's tasks via the underlying SELECT/UPDATE policies.

create or replace function public.assign_task(
  p_task_id uuid,
  p_assignee_id uuid
)
returns public.tasks
language plpgsql
as $$
declare
  v_task public.tasks;
  v_caller_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Không tìm thấy công việc';
  end if;

  -- Defense in depth: RLS's UPDATE policy would silently affect 0 rows for a cross-centre task
  -- (caller can SELECT broadly but not UPDATE outside their centre) — raise a clear error instead.
  if v_task.centre_id <> v_caller_centre then
    raise exception 'Công việc không thuộc trung tâm của bạn';
  end if;

  if not exists (
    select 1 from public.employees
    where id = p_assignee_id and centre_id = v_task.centre_id and is_active
  ) then
    raise exception 'Người được giao phải thuộc cùng trung tâm với công việc và đang hoạt động';
  end if;

  update public.tasks set assignee_id = p_assignee_id where id = p_task_id returning * into v_task;
  return v_task;
end;
$$;

grant execute on function public.assign_task(uuid, uuid) to authenticated;
