# Contract: Triggers & Functions (`*_kpi_functions.sql`)

The column-level guard, the atomic approval transitions, and the RLS-tiered aggregations. All run
**SECURITY INVOKER** so RLS stays authoritative. Exceptions are Vietnamese (surfaced via `withError`).

---

## `enforce_actual_only` — BEFORE UPDATE trigger on `personal_kpis` (§13, D-ACTUAL)

Column-level enforcement RLS cannot express; also auto-reverts to `pending` on an owner edit.

```sql
create or replace function public.enforce_actual_only()
returns trigger language plpgsql as $$
declare
  v_role text := (select auth.jwt() ->> 'app_role');
  v_actor uuid := (select (auth.jwt() ->> 'employee_id'))::uuid;
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
      NEW.approval_status := 'pending';    -- editing (any state) reverts to pending (AC-1.4/7.5)
      NEW.updated_at := now();
    end if;
  else
    -- Elevated roles (manager/admin) set target here; they must NOT fabricate actuals.
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

-- Companion AFTER trigger writes the status-log when an owner edit flips status to pending.
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
```

> Creation log (`null → pending`) is written by the record-actual **service** on INSERT (or an
> AFTER INSERT trigger); the guarded functions below write the approve/reject logs.

---

## `approve_personal_kpi` / `reject_personal_kpi` — atomic transitions (§V, D-APPROVAL)

Mirrors `change_task_status`: lock, assert state + scope, update, log — one call. SECURITY INVOKER, so
RLS forbids touching another centre's row.

```sql
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
```

**Isolation note**: because these are SECURITY INVOKER, the `select ... for update` and `update` are
themselves subject to `pkpi_update_scoped` RLS — a centre-A manager calling `approve_personal_kpi` on
a centre-B row gets `not found` (row invisible), so cross-centre approval is impossible without any
extra check (AC-6.3/7.3).

---

## `kpi_dashboard` / `kpi_leaderboard` — RLS-tiered aggregation (D-AGG)

SECURITY INVOKER `GROUP BY` over **approved** actuals; RLS auto-scopes visible rows to the caller's
tier. `claims` lacks `department_id`, so `department` grouping joins `employees`.

```sql
-- Per-consultant attainment for a period, tier-scoped, approved-only.
create or replace function public.kpi_dashboard(p_period text)
returns table (consultant_id uuid, consultant_name text, centre_id uuid, department_id uuid,
               metric_key text, approved_actual bigint, target bigint)
language sql stable security invoker as $$
  select k.consultant_id, e.full_name, k.centre_id, e.department_id, k.metric_key,
         sum(k.actual) filter (where k.approval_status = 'approved')::bigint as approved_actual,
         max(k.target) as target
  from public.personal_kpis k
  join public.employees e on e.id = k.consultant_id
  where k.period = p_period            -- RLS on personal_kpis auto-limits rows to the caller's tier
  group by k.consultant_id, e.full_name, k.centre_id, e.department_id, k.metric_key;
$$;

-- Ranked consultants by one metric/period, approved-only, deterministic tie-break by name.
create or replace function public.kpi_leaderboard(p_period text, p_metric text)
returns table (consultant_id uuid, consultant_name text, centre_id uuid, approved_actual bigint, rank bigint)
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
  ) s;
$$;
```

- Centre/department/network rollups are `SUM` over the same tier-scoped function output (done in SQL
  or the pure `rollup.ts`, which only ever receives rows the caller may see).
- Quarter/year rollups pass the member `YYYY-MM` periods and sum (D-PERIOD).
- **Pagination (FR-CALC-03)**: `kpi_dashboard`/`kpi_leaderboard` accept optional `p_limit`/`p_offset`;
  the read actions wrap the result as `Paginated<T>`. A single-period result is bounded by staff count
  (low hundreds at the SC-008 baseline), so this is a bound-and-page, not an unbounded scan.
