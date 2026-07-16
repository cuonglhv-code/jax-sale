-- Guarded/compound writes as Postgres functions (constitution Principle V, research R3). SECURITY
-- INVOKER (default) so RLS still enforces centre confinement — no cross-centre fan-out in this
-- slice. Each runs atomically: a partial write is impossible and the status-log invariant holds.

-- ── General audit-log seam (FR-024g) ─────────────────────────────────────────
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default null
)
returns void
language plpgsql
as $$
declare
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
begin
  insert into public.audit_log (actor_id, action, entity_type, entity_id, centre_id, metadata)
  values (v_actor, p_action, p_entity_type, p_entity_id, v_centre, p_metadata);
end;
$$;

-- ── Atomic task create + initial (null → TODO) status log (FR-018/022) ────────
create or replace function public.create_task_with_log(
  p_assignee_id uuid,
  p_department_id uuid,
  p_description text,
  p_group text,
  p_priority text,
  p_deadline date,
  p_source text,
  p_note text default null
)
returns public.tasks
language plpgsql
as $$
declare
  v_task public.tasks;
  v_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
begin
  -- Defense in depth: assignee must be an active employee of the caller's own centre (FR-019).
  if not exists (
    select 1 from public.employees
    where id = p_assignee_id and centre_id = v_centre and is_active
  ) then
    raise exception 'Người được giao không thuộc trung tâm của bạn hoặc đã bị vô hiệu hóa';
  end if;

  insert into public.tasks (
    centre_id, assignee_id, department_id, description, "group",
    priority, deadline, status, source, note, created_by
  )
  values (
    v_centre, p_assignee_id, p_department_id, p_description, p_group,
    p_priority, p_deadline, 'TODO', p_source, p_note, v_actor
  )
  returning * into v_task;

  insert into public.task_status_logs (task_id, centre_id, from_status, to_status, changed_by_id, note)
  values (v_task.id, v_centre, null, 'TODO', v_actor, null);

  return v_task;
end;
$$;

-- ── Atomic status change + log on EVERY transition (FR-020/021) ───────────────
-- Null target → automatic cycle TODO→DOING→DONE→TODO. Explicit target → set as named
-- (BLOCK/RESCHEDULED/CANCELLED reachable only this way; auto-cycle never enters/leaves them).
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
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Không tìm thấy công việc';
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

grant execute on function public.write_audit_log(text, text, uuid, jsonb) to authenticated;
grant execute on function public.create_task_with_log(uuid, uuid, text, text, text, date, text, text) to authenticated;
grant execute on function public.change_task_status(uuid, text, text) to authenticated;
