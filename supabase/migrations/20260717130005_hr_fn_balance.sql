-- HR module (slice 004), T026 — the annual-leave ledger's guarded write primitives (data-model §8/
-- §11, US3). Unlike US1's create_hr_request_with_log (SECURITY INVOKER — the caller writes their OWN
-- row and hr_request's RLS + grants already permit that), `leave_balance` deliberately has NO
-- INSERT/UPDATE grant for `authenticated` at all (20260717130003_hr_rls.sql: "consumed_days is
-- written only inside the guarded balance functions"). A SECURITY INVOKER function cannot bypass a
-- missing table grant, so these four functions are SECURITY DEFINER — the one place in this slice
-- data-model §11 calls out as "used only where a cross-scope check is unavoidable": the actor
-- deciding/adjusting (a centre_manager or super_admin) is never the row owner, so there is no RLS
-- shape that both (a) lets the guarded function write and (b) keeps direct client writes impossible.
-- Each function performs its OWN role/centre check against auth.jwt() to compensate for RLS being
-- bypassed. `set search_path = public` pins name resolution (Postgres/Supabase SECURITY DEFINER
-- best practice — prevents a search_path-hijack of an unqualified call).

-- ── recompute_entitlement — derive entitlement_days from policy + hire_date/employment_type ──────
-- Mirrors the pure calculation in src/lib/hr/entitlement.ts (computeEntitlementDays) — keep both in
-- sync when the formula changes; the TS version is the unit-tested source of truth for the
-- arithmetic (T023), this is its SQL twin (Postgres cannot call out to TS). Idempotent: upserts the
-- (employee_id, leave_year) row, updating entitlement_days on conflict without touching consumed_days
-- or opening_adjustment_days.
create or replace function public.recompute_entitlement(p_employee_id uuid, p_leave_year int)
returns public.leave_balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_hire_date date;
  v_employment_type text;
  v_employee_centre uuid;
  v_baseline numeric;
  v_extra_per_years numeric;
  v_years_step int;
  v_part_time_prorate boolean;
  v_hire_year int;
  v_years_of_service int;
  v_seniority_days numeric;
  v_months_worked int;
  v_total numeric;
  v_balance public.leave_balance;
begin
  select hire_date, employment_type, centre_id
    into v_hire_date, v_employment_type, v_employee_centre
    from public.employees where id = p_employee_id;
  if not found then raise exception 'Không tìm thấy nhân viên'; end if;

  if v_role <> 'super_admin' and not (v_role = 'centre_manager' and v_employee_centre = v_actor_centre) then
    raise exception 'Không có quyền tính lại số ngày phép';
  end if;

  select annual_baseline_days, seniority_extra_days_per_years, seniority_years_step, part_time_prorate
    into v_baseline, v_extra_per_years, v_years_step, v_part_time_prorate
    from public.leave_policy_config where leave_year = p_leave_year;
  if not found then
    raise exception 'Chưa cấu hình chính sách nghỉ phép cho năm %', p_leave_year;
  end if;

  v_hire_year := extract(year from v_hire_date)::int;

  if v_hire_year > p_leave_year then
    v_total := 0;
  else
    -- Full years of service completed BEFORE the leave year starts (Jan 1) — age() is
    -- anniversary-aware, matching fullYearsBefore() in entitlement.ts.
    v_years_of_service := greatest(0, extract(year from age(make_date(p_leave_year, 1, 1), v_hire_date))::int);
    v_seniority_days := floor(v_years_of_service / v_years_step) * v_extra_per_years;
    v_total := v_baseline + v_seniority_days;

    if v_hire_year = p_leave_year then
      -- Mid-year hire: pro-rate by completed months worked within the leave year (hire month inclusive).
      v_months_worked := 12 - extract(month from v_hire_date)::int + 1;
      v_total := v_total * (v_months_worked / 12.0);
    end if;
  end if;

  if v_employment_type = 'part_time' and v_part_time_prorate then
    v_total := v_total * 0.5;
  end if;

  v_total := round(v_total, 1);

  insert into public.leave_balance (employee_id, leave_year, entitlement_days, consumed_days, opening_adjustment_days, updated_at)
  values (p_employee_id, p_leave_year, v_total, 0, 0, now())
  on conflict (employee_id, leave_year)
  do update set entitlement_days = excluded.entitlement_days, updated_at = now()
  returning * into v_balance;

  return v_balance;
end;
$$;

grant execute on function public.recompute_entitlement(uuid, int) to authenticated;

-- ── consume_leave_balance — draw down consumed_days on approval (annual_leave only) ──────────────
-- IDEMPOTENCY CONTRACT (read this before wiring a caller): this function computes and applies ONE
-- delta per call — it has no memory of whether it has already been called for a given request. It
-- is the future `approve_request` (US2, T033) that MUST guard the pending → approved transition
-- (`status = 'pending'` precondition) so a retried/duplicate approval never calls this twice for the
-- same request. This function only proves the ledger arithmetic + the no-double-spend row lock; the
-- "call exactly once" guarantee is the caller's responsibility, documented here because that caller
-- does not exist yet in this slice.
create or replace function public.consume_leave_balance(p_request_id uuid)
returns public.leave_balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_request_type text;
  v_submitter_id uuid;
  v_centre_id uuid;
  v_start_date date;
  v_working_days numeric;
  v_leave_year int;
  v_balance public.leave_balance;
begin
  select request_type, submitter_id, centre_id, start_date, working_days
    into v_request_type, v_submitter_id, v_centre_id, v_start_date, v_working_days
    from public.hr_request where id = p_request_id;
  if not found then raise exception 'Không tìm thấy yêu cầu'; end if;
  if v_request_type <> 'annual_leave' then
    raise exception 'Chỉ áp dụng cho yêu cầu nghỉ phép năm';
  end if;
  if v_working_days is null then
    raise exception 'Yêu cầu chưa có số ngày làm việc để trừ phép';
  end if;

  -- Only the deciding actor set (mirrors hr_request_update_decider) may draw down a balance.
  if v_role <> 'super_admin' and not (v_role = 'centre_manager' and v_centre_id = v_actor_centre) then
    raise exception 'Không có quyền trừ số dư phép';
  end if;

  v_leave_year := extract(year from v_start_date)::int;

  select * into v_balance from public.leave_balance
    where employee_id = v_submitter_id and leave_year = v_leave_year
    for update;   -- the no-double-spend guarantee (FR-013): serializes concurrent consumers
  if not found then
    raise exception 'Chưa có số dư phép năm % cho nhân viên này', v_leave_year;
  end if;

  update public.leave_balance
    set consumed_days = consumed_days + v_working_days, updated_at = now()
    where id = v_balance.id
    returning * into v_balance;

  return v_balance;
end;
$$;

grant execute on function public.consume_leave_balance(uuid) to authenticated;

-- ── restore_leave_balance — reverse a consumption on withdraw/cancel ──────────────────────────────
-- Same idempotency contract as consume_leave_balance: one delta per call, caller (US2's
-- cancel_or_withdraw_request, T037) is responsible for calling it exactly once. Additionally permits
-- the request's own submitter (self-withdraw is submitter-initiated, not decider-initiated).
create or replace function public.restore_leave_balance(p_request_id uuid)
returns public.leave_balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor_centre uuid := (select (auth.jwt() ->> 'centre_id'))::uuid;
  v_actor_employee uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
  v_request_type text;
  v_submitter_id uuid;
  v_centre_id uuid;
  v_start_date date;
  v_working_days numeric;
  v_leave_year int;
  v_balance public.leave_balance;
begin
  select request_type, submitter_id, centre_id, start_date, working_days
    into v_request_type, v_submitter_id, v_centre_id, v_start_date, v_working_days
    from public.hr_request where id = p_request_id;
  if not found then raise exception 'Không tìm thấy yêu cầu'; end if;
  if v_request_type <> 'annual_leave' then
    raise exception 'Chỉ áp dụng cho yêu cầu nghỉ phép năm';
  end if;
  if v_working_days is null then
    raise exception 'Yêu cầu chưa có số ngày làm việc để hoàn phép';
  end if;

  if v_role <> 'super_admin'
     and not (v_role = 'centre_manager' and v_centre_id = v_actor_centre)
     and v_submitter_id <> v_actor_employee then
    raise exception 'Không có quyền hoàn số dư phép';
  end if;

  v_leave_year := extract(year from v_start_date)::int;

  select * into v_balance from public.leave_balance
    where employee_id = v_submitter_id and leave_year = v_leave_year
    for update;
  if not found then
    raise exception 'Chưa có số dư phép năm % cho nhân viên này', v_leave_year;
  end if;

  update public.leave_balance
    set consumed_days = consumed_days - v_working_days, updated_at = now()
    where id = v_balance.id
    returning * into v_balance;

  return v_balance;
end;
$$;

grant execute on function public.restore_leave_balance(uuid) to authenticated;

-- ── adjust_opening_balance — super_admin-only manual opening adjustment (FR-047) ──────────────────
create or replace function public.adjust_opening_balance(
  p_employee_id uuid, p_leave_year int, p_delta_days numeric, p_reason text
)
returns public.leave_balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_balance public.leave_balance;
begin
  if v_role <> 'super_admin' then
    raise exception 'Chỉ quản trị hệ thống được điều chỉnh số dư phép';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Vui lòng nhập lý do điều chỉnh';
  end if;

  insert into public.leave_balance (employee_id, leave_year, entitlement_days, consumed_days, opening_adjustment_days, updated_at)
  values (p_employee_id, p_leave_year, 0, 0, p_delta_days, now())
  on conflict (employee_id, leave_year)
  do update set opening_adjustment_days = public.leave_balance.opening_adjustment_days + p_delta_days, updated_at = now()
  returning * into v_balance;

  perform public.write_audit_log(
    'leaveBalance.adjust', 'leave_balance', v_balance.id,
    jsonb_build_object('deltaDays', p_delta_days, 'reason', p_reason, 'employeeId', p_employee_id, 'leaveYear', p_leave_year)
  );

  return v_balance;
end;
$$;

grant execute on function public.adjust_opening_balance(uuid, int, numeric, text) to authenticated;
