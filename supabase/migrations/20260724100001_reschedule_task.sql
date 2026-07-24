-- Guarded task reschedule (calendar drag-and-drop). Same-centre-only, teacher scope limited
-- to own tasks — mirrors assign_task (20260716120005) and change_task_status (20260716120006)
-- defence-in-depth patterns.

create or replace function public.reschedule_task(
  p_task_id uuid,
  p_new_deadline date
)
returns public.tasks
language plpgsql
as $$
declare
  v_task public.tasks;
  v_caller_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_role text := (select (auth.jwt() ->> 'app_role'));
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Không tìm thấy công việc';
  end if;

  if v_task.centre_id <> v_caller_centre then
    raise exception 'Công việc không thuộc trung tâm của bạn';
  end if;

  if v_role = 'teacher' and v_task.assignee_id <> v_actor then
    raise exception 'Bạn chỉ có thể thay đổi hạn công việc được giao cho mình';
  end if;

  update public.tasks set deadline = p_new_deadline where id = p_task_id returning * into v_task;
  return v_task;
end;
$$;

grant execute on function public.reschedule_task(uuid, date) to authenticated;
