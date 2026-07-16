-- Slice #003 — KPI triggers & functions (contracts/kpi-functions.md). The column-level actual-only
-- guard (§13), the atomic approval transitions (§V, mirrors change_task_status), and the RLS-tiered
-- aggregations. All SECURITY INVOKER so RLS stays authoritative. Exceptions are Vietnamese.

-- ── enforce_actual_only — BEFORE UPDATE column-level guard (§13, D-ACTUAL) ──
create or replace function public.enforce_actual_only()
returns trigger language plpgsql as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
begin
  if v_role = 'sale_consultant' then
    -- Owner may change ONLY actual. Any other column change is rejected.
    if NEW.target is distinct from OLD.target
       or NEW.consultant_id <> OLD.consultant_id
       or NEW.centre_id <> OLD.centre_id
       or NEW.period <> OLD.period
       or NEW.metric_key <> OLD.metric_key
       or NEW.approval_status is distinct from OLD.approval_status then
      raise exception 'Bạn chỉ được cập nhật kết quả thực tế của mình';
    end if;
    if NEW.actual is distinct from OLD.actual then
      NEW.approval_status := 'pending';   -- editing (any state) reverts to pending (AC-1.4/7.5)
      NEW.updated_at := now();
    end if;
  else
    -- Elevated roles (manager/admin/super_admin) set target / drive approval; never fabricate actuals.
    if NEW.actual is distinct from OLD.actual then
      raise exception 'Quản lý không được chỉnh sửa kết quả thực tế của tư vấn viên';
    end if;
    NEW.updated_at := now();
  end if;
  return NEW;
end;
$$;

create trigger trg_enforce_actual_only
  before update on public.personal_kpis
  for each row execute function public.enforce_actual_only();

-- ── Creation log (null → pending) on INSERT (§V: every lifecycle entity logs at creation) ──
create or replace function public.log_actual_insert()
returns trigger language plpgsql as $$
begin
  insert into public.personal_kpi_status_logs (entry_id, centre_id, from_status, to_status, changed_by_id)
  values (NEW.id, NEW.centre_id, null, NEW.approval_status,
          (select (auth.jwt() ->> 'employee_id'))::uuid);
  return null;
end;
$$;
create trigger trg_log_actual_insert
  after insert on public.personal_kpis
  for each row execute function public.log_actual_insert();

-- ── Edit-driven revert-to-pending log (AFTER UPDATE) ──
create or replace function public.log_actual_edit_transition()
returns trigger language plpgsql as $$
begin
  if NEW.approval_status = 'pending' and OLD.approval_status is distinct from 'pending' then
    insert into public.personal_kpi_status_logs
      (entry_id, centre_id, from_status, to_status, changed_by_id)
    values (NEW.id, NEW.centre_id, OLD.approval_status, 'pending',
            (select (auth.jwt() ->> 'employee_id'))::uuid);
  end if;
  return null;
end;
$$;
create trigger trg_log_actual_edit
  after update on public.personal_kpis
  for each row execute function public.log_actual_edit_transition();

-- ── approve / reject — atomic transition + status-log (§V, D-APPROVAL). SECURITY INVOKER: RLS
--    makes a cross-centre approval impossible (the row is invisible → 'not found'). ──
create or replace function public.approve_personal_kpi(p_entry_id uuid)
returns public.personal_kpis language plpgsql as $$
declare
  v_row public.personal_kpis;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
begin
  select * into v_row from public.personal_kpis where id = p_entry_id for update;
  if not found then raise exception 'Không tìm thấy chỉ số KPI'; end if;
  if v_row.approval_status <> 'pending' then
    raise exception 'Chỉ có thể duyệt chỉ số đang chờ duyệt';
  end if;
  update public.personal_kpis set approval_status = 'approved', updated_at = now()
    where id = p_entry_id returning * into v_row;
  insert into public.personal_kpi_status_logs
    (entry_id, centre_id, from_status, to_status, changed_by_id)
  values (p_entry_id, v_row.centre_id, 'pending', 'approved', v_actor);
  return v_row;
end;
$$;

create or replace function public.reject_personal_kpi(p_entry_id uuid, p_note text default null)
returns public.personal_kpis language plpgsql as $$
declare
  v_row public.personal_kpis;
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
begin
  select * into v_row from public.personal_kpis where id = p_entry_id for update;
  if not found then raise exception 'Không tìm thấy chỉ số KPI'; end if;
  if v_row.approval_status <> 'pending' then
    raise exception 'Chỉ có thể từ chối chỉ số đang chờ duyệt';
  end if;
  update public.personal_kpis set approval_status = 'rejected', updated_at = now()
    where id = p_entry_id returning * into v_row;
  insert into public.personal_kpi_status_logs
    (entry_id, centre_id, from_status, to_status, changed_by_id, note)
  values (p_entry_id, v_row.centre_id, 'pending', 'rejected', v_actor, p_note);
  return v_row;
end;
$$;

-- ── Aggregations (RLS-tiered; approved-only; paginated FR-CALC-03). SECURITY INVOKER so the tiered
--    SELECT policy auto-scopes summed rows; join employees for department (claims lack department_id). ──
create or replace function public.kpi_dashboard(
  p_period text, p_limit int default null, p_offset int default 0
)
returns table (consultant_id uuid, consultant_name text, centre_id uuid, department_id uuid,
               metric_key text, approved_actual bigint, target bigint)
language sql stable security invoker as $$
  select k.consultant_id, e.full_name, k.centre_id, e.department_id, k.metric_key,
         coalesce(sum(k.actual) filter (where k.approval_status = 'approved'), 0)::bigint as approved_actual,
         max(k.target) as target
  from public.personal_kpis k
  join public.employees e on e.id = k.consultant_id
  where k.period = p_period
  group by k.consultant_id, e.full_name, k.centre_id, e.department_id, k.metric_key
  order by e.full_name asc
  limit coalesce(p_limit, 2147483647) offset p_offset;
$$;

create or replace function public.kpi_leaderboard(
  p_period text, p_metric text, p_limit int default null, p_offset int default 0
)
returns table (consultant_id uuid, consultant_name text, centre_id uuid,
               approved_actual bigint, rank bigint)
language sql stable security invoker as $$
  select consultant_id, full_name, centre_id, approved_actual,
         row_number() over (order by approved_actual desc, full_name asc) as rank
  from (
    select k.consultant_id, e.full_name, k.centre_id,
           coalesce(sum(k.actual) filter (where k.approval_status = 'approved'), 0)::bigint as approved_actual
    from public.personal_kpis k
    join public.employees e on e.id = k.consultant_id
    where k.period = p_period and k.metric_key = p_metric
    group by k.consultant_id, e.full_name, k.centre_id
  ) s
  order by approved_actual desc, full_name asc
  limit coalesce(p_limit, 2147483647) offset p_offset;
$$;
