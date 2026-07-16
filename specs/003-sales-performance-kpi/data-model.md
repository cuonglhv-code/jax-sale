# Data Model: Sales Performance & KPI Tracker

Phase 1 output. Tables, app types, RLS shape, the actual-only trigger, and the guarded/aggregation
functions. Enum string VALUES are the contract; Vietnamese labels live in `vocabulary.ts`. App types
are camelCase; DB columns snake_case (converted at the service boundary via `case.ts`). Full policy
text: [contracts/rls-policies.md](./contracts/rls-policies.md); function bodies:
[contracts/kpi-functions.md](./contracts/kpi-functions.md).

---

## Enums (add to `src/lib/data/types.ts`)

```ts
export const METRIC_KEYS = ["enrolments_closed", "revenue"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const APPROVAL_STATES = ["pending", "approved", "rejected"] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

// Derived, not persisted — computed by the attainment engine.
export const ATTAINMENT_STATES = ["not_set", "on_track", "behind", "no_result"] as const;
export type AttainmentState = (typeof ATTAINMENT_STATES)[number];
```

`METRIC_KEYS` is the seed catalog; the metric list is data (extensible) but the string values are a
stable contract. A period is a `YYYY-MM` string (validated by schema + a DB CHECK regex).

---

## Tables (new migration `*_kpi_schema.sql`)

### `personal_kpis` — one row per (consultant, period, metric); §13 own-row, actual-only

```sql
create table public.personal_kpis (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.employees (id),
  centre_id uuid not null references public.centres (id),      -- denormalized for RLS/index (= consultant's centre)
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),   -- YYYY-MM
  metric_key text not null check (metric_key in ('enrolments_closed', 'revenue')),
  target bigint check (target is null or target > 0),          -- NULL = "not set" (never 0%); 0 rejected (D-ZERO)
  actual bigint not null default 0 check (actual >= 0),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultant_id, period, metric_key)
);
```

- `centre_id` is denormalized (= the consultant's centre) so RLS/indexes need no join on the hot path;
  it is set by the service from `claims`/the consultant's `employees` row, never client-supplied.
- `target` NULL ⇒ attainment `not_set` (never 0%). `target > 0` enforced (D-ZERO).
- `actual` owner-writable (trigger-guarded); `approval_status` changed only by trigger (on edit) or
  the guarded approve/reject functions.

### `department_kpi_targets` — network-wide, admin-only (§13 `kpi_metrics`)

```sql
create table public.department_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id),   -- flat, network-wide (no centre_id)
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  metric_key text not null check (metric_key in ('enrolments_closed', 'revenue')),
  target bigint not null check (target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, period, metric_key)
);
```

- **No `centre_id`** — department targets are network-wide (mirrors `departments`). Written by
  `super_admin` only (Pattern B).

### `personal_kpi_status_logs` — append-only; written on EVERY transition (§V)

```sql
create table public.personal_kpi_status_logs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.personal_kpis (id) on delete cascade,
  centre_id uuid not null references public.centres (id),
  from_status text check (from_status in ('pending', 'approved', 'rejected')),  -- NULL at creation
  to_status text not null check (to_status in ('pending', 'approved', 'rejected')),
  changed_by_id uuid not null references public.employees (id),
  note text,                                                   -- e.g. rejection reason
  changed_at timestamptz not null default now()
);
```

Mirrors `task_status_logs`. `from_status` NULL = creation log (`null → pending`).

### Indexes

```sql
create index idx_personal_kpis_consultant on public.personal_kpis (consultant_id);
create index idx_personal_kpis_centre on public.personal_kpis (centre_id);
create index idx_personal_kpis_period on public.personal_kpis (period);
create index idx_personal_kpis_status on public.personal_kpis (approval_status);
create index idx_dept_targets_period on public.department_kpi_targets (period);
create index idx_kpi_status_logs_entry on public.personal_kpi_status_logs (entry_id);
```

---

## App types (add to `src/lib/data/types.ts`)

```ts
export interface PersonalKpiEntry {
  id: string;
  consultantId: string;
  centreId: string;
  period: string;          // YYYY-MM
  metricKey: MetricKey;
  target: number | null;   // null = not set
  actual: number;
  approvalStatus: ApprovalState;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentKpiTarget {
  id: string;
  departmentId: string;
  period: string;
  metricKey: MetricKey;
  target: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalKpiStatusLog {
  id: string;
  entryId: string;
  centreId: string;
  fromStatus: ApprovalState | null;
  toStatus: ApprovalState;
  changedById: string;
  note: string | null;
  changedAt: string;
}

/** Derived attainment (never persisted) — output of the attainment engine. */
export interface Attainment {
  metricKey: MetricKey;
  approvedActual: number;  // sum of approved actuals in scope
  target: number | null;
  ratio: number | null;    // approvedActual / target, or null when target is null
  state: AttainmentState;
}

/** A dashboard row at some scope (consultant | centre | department | network). */
export interface KpiDashboardRow {
  scopeId: string;         // consultantId | centreId | departmentId | "network"
  scopeName: string;       // Vietnamese display name
  attainments: Attainment[];
}
```

---

## State transitions — `personal_kpis.approval_status` (constitution §V)

```
            record actual                     approve (manager)
   (none) ───────────────▶ pending ───────────────────────────▶ approved
                             ▲  │                                    │
        consultant edit      │  │ reject (manager)                  │ consultant edit
        (any state → pending)│  ▼                                    │ (→ pending)
                             │ rejected ───────────────────────────┘
                             └───────── consultant edit ────────────
```

- **Every** arrow writes a `personal_kpi_status_logs` row (actor + from/to). Creation writes
  `null → pending`.
- Only `approved` contributes to aggregates/attainment/ranking/export.
- `approve`/`reject` are valid only **from `pending`** (guarded function raises otherwise).
- A consultant edit from any state (incl. `approved`) → `pending` (trigger-enforced; AC-1.4/7.5).

---

## Actual-only trigger (`enforce_actual_only`, BEFORE UPDATE on `personal_kpis`)

Column-level guard that RLS cannot express (§13 "RLS + a BEFORE UPDATE trigger"). Full body in
[contracts/kpi-functions.md](./contracts/kpi-functions.md). Behavior:

- If the acting role (`auth.jwt() ->> 'app_role'`) is `sale_consultant`:
  - reject (raise) any change to `target`, `consultant_id`, `centre_id`, `period`, `metric_key`.
  - reject a direct change to `approval_status` (owners never set status directly).
  - if `NEW.actual <> OLD.actual`: set `NEW.approval_status = 'pending'`, bump `updated_at`, and
    (AFTER-insert) write the `null`-less status-log `OLD.approval_status → pending`.
- Manager/admin target writes change only `target` (the service updates that column; the trigger
  leaves elevated roles' `target` writes alone but still forbids them writing `actual`).
- `approval_status` transitions by managers happen **only** through the guarded functions, not raw
  UPDATE.

## RLS (summary; full text in contracts/rls-policies.md)

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `personal_kpis` | **Tiered** (new): super_admin=all; centre_manager/centre_admin=own centre; sale_consultant=own `consultant_id`; teacher=none | INSERT/UPDATE centre-narrow (`centre_id = own`); owner path further column-limited by the trigger; department targets N/A here |
| `department_kpi_targets` | super_admin + centre_manager/centre_admin (managers read for department attainment) | Pattern B: write only when `app_role = 'super_admin'` |
| `personal_kpi_status_logs` | Tiered like `personal_kpis` (via `centre_id`) | INSERT own-centre; no UPDATE/DELETE (append-only) |

## Functions (summary; bodies in contracts/kpi-functions.md)

- `approve_personal_kpi(p_entry_id uuid) returns personal_kpis` — SECURITY INVOKER; lock row; assert
  `pending` and `centre_id = own`; set `approved`; insert status-log; (service emits audit).
- `reject_personal_kpi(p_entry_id uuid, p_note text) returns personal_kpis` — same, sets `rejected`.
- `kpi_dashboard(p_period text) returns table(...)` — SECURITY INVOKER; `GROUP BY` approved actuals,
  join `employees` for department/name; RLS auto-tiers rows.
- `kpi_leaderboard(p_period text, p_metric text) returns table(...)` — SECURITY INVOKER; ranked
  approved sums, deterministic tie-break by name.

## Validation rules (from spec → enforced where)

| Rule | Enforced at |
|---|---|
| `actual` ≥ 0, integer | Zod + DB CHECK |
| `target` > 0 or NULL (0 rejected) | Zod + DB CHECK (D-ZERO) |
| `period` matches `YYYY-MM` | Zod regex + DB CHECK |
| owner writes `actual` only; cannot approve | trigger + no `approveActual` key + RLS |
| approve/reject only from `pending`, own centre | guarded function + RLS |
| department target: super_admin only | permission key + Pattern-B RLS |
| NULL target ⇒ not_set, never 0% | attainment engine (no ratio when target null) |
| only approved counts | aggregation functions filter `approval_status = 'approved'` |
| status-log on every transition | trigger (edit) + guarded functions (approve/reject) |
