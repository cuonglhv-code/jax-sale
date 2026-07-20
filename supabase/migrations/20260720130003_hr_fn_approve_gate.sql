-- HR module (slice 004), US4 (T042 follow-up) — `create or replace` approve_request to distinguish
-- a genuine "not yet approvable" state from the idempotent "already decided, retried" no-op.
--
-- The ORIGINAL approve_request (20260717130006_hr_fn_decide.sql) treated ANY non-'pending' status
-- as an idempotent no-op — correct for 'approved' (a retried approval call) but WRONG for
-- 'awaiting_cover': that status means the request cannot be approved YET (a cover is still
-- unaccepted), which must surface as an error to the caller, not silently return the unchanged row
-- as if nothing were wrong. Without this distinction, `us4-cover.test.ts`'s "approve is gated until
-- accepted" proof would silently pass through — the manager's approve click would appear to
-- succeed (no error) while the request secretly stayed `awaiting_cover`, which is a worse UX/
-- correctness bug than a loud rejection.
--
-- All other logic (self-approval guard, cover-acceptance check, balance consumption, history/audit)
-- is UNCHANGED from 20260717130006 — only the idempotency branch is refined.
create or replace function public.approve_request(p_request_id uuid)
returns public.hr_request
language plpgsql
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor_employee uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_request public.hr_request;
  v_unaccepted_covers int;
begin
  select * into v_request from public.hr_request where id = p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy yêu cầu';
  end if;

  if v_role <> 'super_admin' and not (v_role = 'centre_manager' and v_request.centre_id = v_actor_centre) then
    raise exception 'Không có quyền duyệt yêu cầu này';
  end if;

  -- Idempotency (retried/duplicate approve of an ALREADY-DECIDED request) is a silent no-op ONLY
  -- for terminal-from-approval statuses. 'awaiting_cover' is NOT idempotent-approved — it is a
  -- genuine "not yet approvable" state that must raise, so the caller cannot mistake a no-op for
  -- success.
  if v_request.status = 'awaiting_cover' then
    raise exception 'Còn giáo viên dạy thay chưa xác nhận cho yêu cầu này';
  end if;
  if v_request.status <> 'pending' then
    return v_request;
  end if;

  -- Self-approval forbidden (FR-026): the submitter can never be the decider, even super_admin
  -- acting on their own request — the app layer (decideRequestCore) is what re-routes guidance to
  -- a system admin; this function's job is only to refuse.
  if v_request.submitter_id = v_actor_employee then
    raise exception 'Bạn không thể tự duyệt yêu cầu của chính mình. Vui lòng liên hệ quản trị hệ thống.';
  end if;

  -- All cover_assignment rows (if any) must be accepted before approval (FR-019). Vacuously true
  -- when no cover rows exist yet (US1/US3-only requests, pre-US4). Kept as a second belt-and-
  -- suspenders check even though a 'pending' request should never have unaccepted covers (the
  -- awaiting_cover branch above already guards that) — cheap and consistent with defense in depth.
  select count(*) into v_unaccepted_covers
    from public.cover_assignment
    where request_id = p_request_id and status <> 'accepted';
  if v_unaccepted_covers > 0 then
    raise exception 'Còn giáo viên dạy thay chưa xác nhận cho yêu cầu này';
  end if;

  if v_request.request_type = 'annual_leave' then
    perform public.consume_leave_balance(p_request_id);
  end if;

  update public.hr_request
    set status = 'approved', decided_by = v_actor_employee, decided_at = now()
    where id = p_request_id
    returning * into v_request;

  insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by, reason)
  values (p_request_id, 'pending', 'approved', v_actor_employee, null);

  return v_request;
end;
$$;

grant execute on function public.approve_request(uuid) to authenticated;
