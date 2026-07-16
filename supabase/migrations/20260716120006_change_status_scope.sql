-- Extend change_task_status with a scope check (spec US4 acceptance scenario 5: "a user
-- attempting to change the status of a task outside their permitted scope ... refused, no log
-- written"). A `teacher` may change status only for tasks assigned to them — a natural extension
-- of FR-017 (own-tasks-only visibility) to writes. Other roles are unrestricted here (broader
-- centre-management responsibility), still confined to their own centre via RLS.

create or replace function public.change_task_status(
  p_task_id uuid,
  p_target text default null,
  p_note text default null
)
returns public.tasks
language plpgsql
as $$
declare
  v_task public.tasks;
  v_from text;
  v_to text;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_role text := (select (auth.jwt() ->> 'app_role'));
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Không tìm thấy công việc';
  end if;

  if v_role = 'teacher' and v_task.assignee_id <> v_actor then
    raise exception 'Bạn chỉ có thể thay đổi trạng thái công việc được giao cho mình';
  end if;

  v_from := v_task.status;

  if p_target is null then
    v_to := case v_from
      when 'TODO' then 'DOING'
      when 'DOING' then 'DONE'
      when 'DONE' then 'TODO'
      else null
    end;
    if v_to is null then
      raise exception 'Không thể tự động chuyển trạng thái từ %', v_from;
    end if;
  else
    if p_target not in ('TODO', 'DOING', 'DONE', 'BLOCK', 'RESCHEDULED', 'CANCELLED') then
      raise exception 'Trạng thái không hợp lệ: %', p_target;
    end if;
    v_to := p_target;
  end if;

  update public.tasks set status = v_to where id = p_task_id returning * into v_task;

  insert into public.task_status_logs (task_id, centre_id, from_status, to_status, changed_by_id, note)
  values (p_task_id, v_task.centre_id, v_from, v_to, v_actor, p_note);

  return v_task;
end;
$$;
