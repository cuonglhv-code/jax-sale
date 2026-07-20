-- HR module (slice 004), US4 bugfix — `create or replace` respond_cover as SECURITY DEFINER.
--
-- BUG: the original respond_cover (20260720130002_hr_fn_cover.sql) was SECURITY INVOKER. Its
-- `select * from hr_request where id = ... for update` therefore ran under the CALLER's RLS — but
-- the caller is the NOMINEE, who is neither the request's submitter nor its centre_manager, so
-- `hr_request_select_scoped` (20260717130003_hr_rls.sql) silently returned zero rows. `select ...
-- into v_request` with no match leaves v_request as a null-fielded record (no exception), so the
-- subsequent `v_request.status = 'awaiting_cover'` check silently evaluated false — the cover row
-- correctly flipped to 'accepted', but the owning request NEVER transitioned to 'pending'. This is
-- exactly the class of bug data-model §11 anticipates: "a SECURITY DEFINER function is used only
-- where a cross-scope check is unavoidable" — a nominee acting on a request they don't own is
-- precisely that case (same rationale as the balance functions in 20260717130005).
--
-- Fix: SECURITY DEFINER (bypasses RLS) + an explicit nominee-identity check (already present) is
-- the ONLY authorization needed here, since respond_cover's entire authority model is "you may only
-- act on YOUR OWN nomination" — there is no centre/role dimension to re-check beyond that, unlike
-- the balance functions which check role+centre because the actor there is a decider, not the
-- resource's own subject.
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
