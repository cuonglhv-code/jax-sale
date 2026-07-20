-- HR module (slice 004), T033 — US2 decide path: approve_request / reject_request /
-- cancel_or_withdraw_request (data-model §9/§11, contracts/hr-requests.actions.md). SECURITY INVOKER
-- (unlike the balance functions in 20260717130005_hr_fn_balance.sql): the caller (centre_manager or
-- super_admin) already holds UPDATE on hr_request via the `hr_request_update_decider` RLS policy
-- (20260717130003_hr_rls.sql), so the status-flip itself needs no elevated privilege — only the
-- balance write (delegated to the existing SECURITY DEFINER consume_leave_balance/
-- restore_leave_balance) crosses that boundary. `set search_path = public` for the same
-- search-path-hijack defense as the DEFINER functions, even though not strictly required for
-- INVOKER functions — cheap consistency.
--
-- IDEMPOTENCY (the critical correctness requirement): approve_request selects the request row
-- `FOR UPDATE` and re-checks `status = 'pending'` AFTER acquiring the lock. A retried/duplicate
-- approval call finds a row no longer in `pending` and returns the row UNCHANGED (no error, no
-- second history row, no second balance draw) — this is what us2-decide.test.ts's "approve twice"
-- assertion exercises: it checks the SECOND call's return + a same-value balance + an
-- unchanged history row count, which only holds if the guard is real and not incidental.

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
  -- Lock the row first so a concurrent duplicate call serializes behind this one, then re-check
  -- status AFTER the lock is held — the actual no-double-approve guarantee (mirrors the ledger's
  -- FOR UPDATE pattern in consume_leave_balance).
  select * into v_request from public.hr_request where id = p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy yêu cầu';
  end if;

  if v_role <> 'super_admin' and not (v_role = 'centre_manager' and v_request.centre_id = v_actor_centre) then
    raise exception 'Không có quyền duyệt yêu cầu này';
  end if;

  -- Idempotency: if the request is no longer pending (already decided by this or a concurrent
  -- call), return the row AS-IS — no error, no re-draw, no duplicate history row.
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
  -- when no cover rows exist yet (US1/US3-only requests, pre-US4).
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

  -- Audit write happens at the service layer (decideRequestCore), matching the established
  -- convention (create_hr_request_with_log likewise does not self-audit) — keeps the guarded SQL
  -- function focused on the atomic state transition only.
  return v_request;
end;
$$;

grant execute on function public.approve_request(uuid) to authenticated;

-- ── reject_request — requires a non-empty reason; no balance interaction ──────────────────────────
create or replace function public.reject_request(p_request_id uuid, p_reason text)
returns public.hr_request
language plpgsql
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor_employee uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_request public.hr_request;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Vui lòng nhập lý do từ chối';
  end if;

  select * into v_request from public.hr_request where id = p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy yêu cầu';
  end if;

  if v_role <> 'super_admin' and not (v_role = 'centre_manager' and v_request.centre_id = v_actor_centre) then
    raise exception 'Không có quyền từ chối yêu cầu này';
  end if;

  if v_request.status <> 'pending' then
    return v_request;   -- idempotent no-op, same discipline as approve_request
  end if;

  if v_request.submitter_id = v_actor_employee then
    raise exception 'Bạn không thể tự từ chối yêu cầu của chính mình. Vui lòng liên hệ quản trị hệ thống.';
  end if;

  update public.hr_request
    set status = 'rejected', decided_by = v_actor_employee, decided_at = now(), decision_reason = p_reason
    where id = p_request_id
    returning * into v_request;

  insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by, reason)
  values (p_request_id, 'pending', 'rejected', v_actor_employee, p_reason);

  return v_request;
end;
$$;

grant execute on function public.reject_request(uuid, text) to authenticated;

-- ── cancel_or_withdraw_request — submitter (own) or super_admin/centre_manager (own-centre) ───────
-- `pending`/`awaiting_cover` → `cancelled`; `approved` → `withdrawn`, restoring any consumed
-- annual-leave balance first. Same idempotency discipline: guards on the CURRENT status so a
-- retried call after the request has already left its origin status is a no-op.
create or replace function public.cancel_or_withdraw_request(p_request_id uuid)
returns public.hr_request
language plpgsql
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor_employee uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_request public.hr_request;
  v_from_status text;
  v_to_status text;
begin
  select * into v_request from public.hr_request where id = p_request_id for update;
  if not found then
    raise exception 'Không tìm thấy yêu cầu';
  end if;

  if v_request.submitter_id <> v_actor_employee
     and v_role <> 'super_admin'
     and not (v_role = 'centre_manager' and v_request.centre_id = v_actor_centre) then
    raise exception 'Không có quyền hủy/rút yêu cầu này';
  end if;

  if v_request.status in ('pending', 'awaiting_cover') then
    v_from_status := v_request.status;
    v_to_status := 'cancelled';
  elsif v_request.status = 'approved' then
    v_from_status := 'approved';
    v_to_status := 'withdrawn';
  else
    return v_request;   -- already terminal (rejected/cancelled/withdrawn) — idempotent no-op
  end if;

  if v_to_status = 'withdrawn' and v_request.request_type = 'annual_leave' then
    perform public.restore_leave_balance(p_request_id);
  end if;

  update public.cover_assignment
    set status = 'released', responded_at = now()
    where request_id = p_request_id and status in ('nominated', 'accepted');

  update public.hr_request
    set status = v_to_status
    where id = p_request_id
    returning * into v_request;

  insert into public.hr_request_status_history (request_id, from_status, to_status, changed_by, reason)
  values (p_request_id, v_from_status, v_to_status, v_actor_employee, null);

  return v_request;
end;
$$;

grant execute on function public.cancel_or_withdraw_request(uuid) to authenticated;
