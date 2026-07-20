-- HR module (slice 004), US4 (T041) — timetable admin + the AM/PM half-day boundary config value.
--
-- am_pm_boundary_time: research R3's ⚠ VERIFY-AT-IMPLEMENTATION caveat required the AM/PM boundary
-- used by the conflict resolver (src/lib/hr/conflict.ts) to be a CONFIG value, not hardcoded noon.
-- Added here (not in the original 20260717130002_hr_schema.sql, which predates US4) via ALTER TABLE
-- + backfill, matching the append-only-migration convention. Default '12:00:00' (noon) preserves
-- today's implicit behavior for existing rows.
alter table public.leave_policy_config
  add column if not exists am_pm_boundary_time time not null default '12:00:00';

-- upsert_class — same-centre-teacher guard (mirrors assign_task's shape, 20260716120005). Insert
-- when p_id is null, update when provided. centre_id is ALWAYS taken from the caller's claims,
-- never from input, so nothing passed in can create/move a class into another centre — consistent
-- with the "claims, never client input" rule used throughout this slice's guarded functions.
create or replace function public.upsert_class(
  p_id uuid,
  p_course_label text,
  p_teacher_id uuid,
  p_weekday int,
  p_start_time time,
  p_end_time time,
  p_start_date date,
  p_end_date date,
  p_is_active boolean
)
returns public.class
language plpgsql
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_caller_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_class public.class;
  v_target_centre uuid;
begin
  if v_role <> 'super_admin' and v_role not in ('centre_manager', 'centre_admin') then
    raise exception 'Không có quyền quản lý lịch dạy';
  end if;

  -- super_admin acting on an EXISTING class keeps that class's own centre (network-wide write);
  -- everyone else (and every NEW class) is pinned to the caller's own centre.
  if p_id is not null and v_role = 'super_admin' then
    select centre_id into v_target_centre from public.class where id = p_id;
    if v_target_centre is null then
      raise exception 'Không tìm thấy lớp học';
    end if;
  else
    v_target_centre := v_caller_centre;
  end if;

  if v_role <> 'super_admin' and p_id is not null then
    if not exists (select 1 from public.class where id = p_id and centre_id = v_caller_centre) then
      raise exception 'Lớp học không thuộc trung tâm của bạn';
    end if;
  end if;

  if not exists (
    select 1 from public.employees
    where id = p_teacher_id and centre_id = v_target_centre and is_active and app_role = 'teacher'
  ) then
    raise exception 'Giáo viên phải thuộc cùng trung tâm và đang hoạt động';
  end if;

  if p_id is null then
    insert into public.class (
      centre_id, course_label, teacher_id, weekday, start_time, end_time, start_date, end_date, is_active
    ) values (
      v_target_centre, p_course_label, p_teacher_id, p_weekday, p_start_time, p_end_time,
      p_start_date, p_end_date, p_is_active
    )
    returning * into v_class;
  else
    update public.class set
      course_label = p_course_label,
      teacher_id = p_teacher_id,
      weekday = p_weekday,
      start_time = p_start_time,
      end_time = p_end_time,
      start_date = p_start_date,
      end_date = p_end_date,
      is_active = p_is_active
    where id = p_id
    returning * into v_class;
  end if;

  return v_class;
end;
$$;

grant execute on function public.upsert_class(uuid, text, uuid, int, time, time, date, date, boolean) to authenticated;
