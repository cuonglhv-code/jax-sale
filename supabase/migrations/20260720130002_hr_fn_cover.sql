-- HR module (slice 004), US4 (T042/T043) — extends create_hr_request_with_log to accept cover
-- nominations atomically, and adds respond_cover (nominee accept/decline).
--
-- `create_hr_request_with_log` gains a `p_covers jsonb` parameter: an array of
-- `{class_id, session_date, nominee_id}` objects. All server-side validation (same-centre nominee,
-- active teacher, no hard conflict) happens in the CALLING service layer (submitRequestCore) BEFORE
-- this RPC is invoked — this function's job is only the atomic insert + initial status, mirroring
-- the existing convention that `create_hr_request_with_log` does no cross-table business validation
-- itself (T018's comment: "US4/T042 will `create or replace` this function to add cover_assignment
-- inserts and set status='awaiting_cover'"). Nonetheless, this function ALSO independently re-checks
-- same-centre + active-teacher for each nominee (defense in depth — a direct RPC call, bypassing the
-- service layer, must not be able to create a cover row for a cross-centre or inactive nominee).
--
-- Status is 'awaiting_cover' when p_covers is non-empty (any freshly-nominated cover starts
-- 'nominated', never pre-accepted at creation — a submitter cannot self-accept on someone else's
-- behalf), else 'pending' as before (US1/US3 unaffected — p_covers defaults to an empty array).
create or replace function public.create_hr_request_with_log(
  p_request_type text,
  p_start_date date default null,
  p_end_date date default null,
  p_day_part text default null,
  p_working_days numeric default null,
  p_amount numeric default null,
  p_payload jsonb default '{}'::jsonb,
  p_covers jsonb default '[]'::jsonb
)
returns public.hr_request
language plpgsql
set search_path = public
as $$
declare
  v_request public.hr_request;
  v_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_status text := 'pending';
  v_cover jsonb;
  v_nominee_id uuid;
begin
  if jsonb_array_length(p_covers) > 0 then
    v_status := 'awaiting_cover';
  end if;

  insert into public.hr_request (
    request_type, submitter_id, centre_id, status, start_date, end_date, day_part,
    working_days, amount, payload
  )
  values (
    p_request_type, v_actor, v_centre, v_status, p_start_date, p_end_date, p_day_part,
    p_working_days, p_amount, p_payload
  )
  returning * into v_request;

  insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by, reason)
  values (v_request.id, null, v_status, v_actor, null);

  for v_cover in select * from jsonb_array_elements(p_covers)
  loop
    v_nominee_id := (v_cover ->> 'nominee_id')::uuid;

    -- Defense in depth: same-centre active teacher, independent of the service-layer check.
    if not exists (
      select 1 from public.employees
      where id = v_nominee_id and centre_id = v_centre and is_active and app_role = 'teacher'
    ) then
      raise exception 'Giáo viên dạy thay phải thuộc cùng trung tâm và đang hoạt động';
    end if;

    insert into public.cover_assignment (request_id, class_id, session_date, nominee_id, status)
    values (
      v_request.id,
      (v_cover ->> 'class_id')::uuid,
      (v_cover ->> 'session_date')::date,
      v_nominee_id,
      'nominated'
    );
  end loop;

  return v_request;
end;
$$;

grant execute on function public.create_hr_request_with_log(text, date, date, text, numeric, numeric, jsonb, jsonb) to authenticated;

-- ── respond_cover — nominee-only accept/decline (contracts/cover-timetable.actions.md) ────────────
-- Accept re-checks the nominee still has no hard conflict (a class could have changed between
-- nomination and response — defense in depth, since the service layer also re-resolves before
-- calling this). If ALL covers on the owning request are now accepted, flips
-- awaiting_cover -> pending. Decline sets 'declined' and leaves the request in awaiting_cover for
-- the submitter to re-nominate (does not auto-cancel — FR-019/022).
--
-- Concurrency note: this function locks the cover_assignment row (FOR UPDATE) and then the owning
-- hr_request row (FOR UPDATE) before checking "are all covers accepted" — so two nominees accepting
-- concurrently on the SAME request serialize on the hr_request row lock, and the second to commit
-- sees the first's already-committed 'accepted' status when it re-reads cover_assignment, making the
-- "all accepted" check race-free.
create or replace function public.respond_cover(p_cover_id uuid, p_accept boolean)
returns public.cover_assignment
language plpgsql
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

  if v_cover.status <> 'nominated' then
    return v_cover;   -- idempotent no-op — already responded
  end if;

  if p_accept then
    select * into v_class from public.class where id = v_cover.class_id;
    if v_class is null or not v_class.is_active then
      raise exception 'Lớp học không còn hoạt động, không thể nhận dạy thay';
    end if;

    -- Re-check the nominee has no hard conflict at this exact session (a class could have changed
    -- since nomination) — same-weekday/date/active-teacher-of-that-class check, mirroring the
    -- resolver's own-session exclusion (resolveAffectedSessions would flag this as a conflict).
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
