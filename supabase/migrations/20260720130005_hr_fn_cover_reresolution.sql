-- HR module (slice 004), US4 (T043a) — post-approval cover disruption (FR-022, edge case: "covering
-- teacher declines after manager approval" / "class cancelled after cover was arranged").
--
-- ── Re-resolution marker (design choice, documented per the task's own guidance) ──────────────────
-- A brand-new RequestStatus value (e.g. 'needs_cover_reresolution') was considered and REJECTED: it
-- would ripple through every status CHECK constraint, every RLS policy that lists statuses
-- explicitly, the approval-queue query's `.in('status', [...])` filter, and every UI status badge —
-- a lot of surface area for what is fundamentally a SECONDARY signal layered on an ALREADY-DECIDED
-- request (the request's primary lifecycle status, e.g. 'approved', does not change; re-resolution
-- is orthogonal to it, not a replacement for it). `hr_request_status_history` + `audit_log` alone
-- were also considered insufficient as the PRIMARY signal: they are event logs, not queryable
-- "current state" — a manager's dashboard would need to compute "any released cover on an approved
-- request with no accepted replacement yet" by replaying history on every read, which is exactly the
-- kind of derived-state-as-a-query the codebase avoids elsewhere (data-model's own "derived values
-- computed, not stored" principle cuts the OTHER way here: this is impractical to compute cheaply
-- per-row across the whole queue). A single boolean column is the minimal solution: cheap to filter
-- on (`where needs_reresolution`), cheap to clear once a human re-resolves it, and does not touch the
-- RequestStatus enum, RLS, or any existing status-based query. history/audit rows STILL record the
-- release event for the full timeline — the boolean is only the "needs attention now" flag.
alter table public.hr_request
  add column if not exists needs_reresolution boolean not null default false;

-- ── release_cover_and_flag — release one cover_assignment row + flag its owning request ───────────
-- SECURITY DEFINER: the caller may be the nominee (declining their own already-accepted cover post-
-- approval) or the timetable admin (deactivating a class, called from within upsert_class) — neither
-- is guaranteed to hold read/write on the OWNING hr_request row under RLS (same cross-scope
-- rationale as respond_cover, 20260720130004). Idempotent: releasing an already-released cover is a
-- no-op (never double-flags or double-audits).
create or replace function public.release_cover_and_flag(p_cover_id uuid)
returns public.cover_assignment
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cover public.cover_assignment;
begin
  select * into v_cover from public.cover_assignment where id = p_cover_id for update;
  if not found then
    raise exception 'Không tìm thấy đề cử dạy thay';
  end if;

  if v_cover.status = 'released' then
    return v_cover;   -- idempotent no-op
  end if;

  update public.cover_assignment
    set status = 'released', responded_at = now()
    where id = p_cover_id
    returning * into v_cover;

  update public.hr_request set needs_reresolution = true where id = v_cover.request_id;

  return v_cover;
end;
$$;

grant execute on function public.release_cover_and_flag(uuid) to authenticated;

-- ── respond_cover — extend to allow declining an ALREADY-ACCEPTED cover (post-approval decline) ───
-- The original respond_cover (20260720130004) only accepted a decline while status = 'nominated' —
-- correct for the pre-approval flow, but FR-022 requires handling a cover that declines AFTER it was
-- already accepted (and the request already approved). This adds that path: declining an 'accepted'
-- cover calls release_cover_and_flag instead of a plain status flip, so the owning request is
-- flagged. Declining a 'nominated' cover is UNCHANGED from before (plain 'declined', request stays
-- awaiting_cover for re-nomination — FR-019, not a post-approval scenario).
create or replace function public.respond_cover(p_cover_id uuid, p_accept boolean)
returns public.cover_assignment
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_cover public.cover_assignment;
  v_request public.hr_request;
  v_unaccepted_count int;
  v_class public.class;
begin
  select * into v_cover from public.cover_assignment where id = p_cover_id for update;
  if not found then
    raise exception 'Không tìm thấy đề cử dạy thay';
  end if;

  if v_cover.nominee_id <> v_actor then
    raise exception 'Bạn không phải là giáo viên được đề cử cho lượt dạy thay này';
  end if;

  if not p_accept and v_cover.status = 'accepted' then
    -- Post-approval decline (FR-022) — release + flag the owning request for re-resolution.
    return public.release_cover_and_flag(p_cover_id);
  end if;

  if v_cover.status <> 'nominated' then
    return v_cover;   -- idempotent no-op — already responded (accepted, declined, or released)
  end if;

  if p_accept then
    select * into v_class from public.class where id = v_cover.class_id;
    if v_class is null or not v_class.is_active then
      raise exception 'Lớp học không còn hoạt động, không thể nhận dạy thay';
    end if;

    if exists (
      select 1 from public.class c
      where c.teacher_id = v_cover.nominee_id
        and c.is_active
        and c.id <> v_cover.class_id
        and extract(isodow from v_cover.session_date) = c.weekday
        and v_cover.session_date between c.start_date and c.end_date
        and c.start_time < v_class.end_time
        and c.end_time > v_class.start_time
    ) then
      raise exception 'Bạn đang có lịch dạy trùng với buổi học này, không thể nhận dạy thay';
    end if;

    update public.cover_assignment
      set status = 'accepted', responded_at = now()
      where id = p_cover_id
      returning * into v_cover;

    select * into v_request from public.hr_request where id = v_cover.request_id for update;

    select count(*) into v_unaccepted_count
      from public.cover_assignment
      where request_id = v_cover.request_id and status <> 'accepted';

    if v_unaccepted_count = 0 and v_request.status = 'awaiting_cover' then
      update public.hr_request set status = 'pending' where id = v_cover.request_id;

      insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by, reason)
      values (v_cover.request_id, 'awaiting_cover', 'pending', v_actor, null);
    end if;
  else
    update public.cover_assignment
      set status = 'declined', responded_at = now()
      where id = p_cover_id
      returning * into v_cover;
    -- Request stays in awaiting_cover — the submitter must re-nominate (FR-019); no status change here.
  end if;

  return v_cover;
end;
$$;

grant execute on function public.respond_cover(uuid, boolean) to authenticated;

-- ── upsert_class — release accepted covers on any deactivated class's affected sessions ───────────
-- Extended (from 20260720130001) so deactivating a class (isActive: true -> false) releases every
-- STILL-ACCEPTED cover_assignment row pointing at that class and flags each owning request — the
-- "class cancelled after cover was arranged" edge case (FR-022). Only fires on the active->inactive
-- transition (not every update) to avoid redundant releases on unrelated edits.
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
  v_was_active boolean;
  v_cover_id uuid;
begin
  if v_role <> 'super_admin' and v_role not in ('centre_manager', 'centre_admin') then
    raise exception 'Không có quyền quản lý lịch dạy';
  end if;

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
    select is_active into v_was_active from public.class where id = p_id;

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

    if v_was_active and not p_is_active then
      for v_cover_id in
        select id from public.cover_assignment where class_id = p_id and status = 'accepted'
      loop
        perform public.release_cover_and_flag(v_cover_id);
      end loop;
    end if;
  end if;

  return v_class;
end;
$$;

grant execute on function public.upsert_class(uuid, text, uuid, int, time, time, date, date, boolean) to authenticated;
