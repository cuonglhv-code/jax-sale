-- Slice #003 — Sales Performance & KPI schema (spec data-model.md). Constitution §13 KPI subsystem:
-- personal_kpis (own-row, actual-only) + department_kpi_targets (network-wide, admin-only), plus an
-- append-only status log (constitution §V). App camelCase ↔ DB snake_case; enum VALUES are the contract.

-- ── Personal KPIs (one row per consultant × period × metric; own-row, actual-only) ──
create table public.personal_kpis (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.employees (id),
  centre_id uuid not null references public.centres (id),          -- = consultant's centre (set server-side)
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'), -- YYYY-MM
  metric_key text not null check (metric_key in ('enrolments_closed', 'revenue')),
  target bigint check (target is null or target > 0),              -- NULL = "not set" (never 0%); 0 rejected
  actual bigint not null default 0 check (actual >= 0),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultant_id, period, metric_key)
);

-- ── Department targets (network-wide, no centre_id; §13 kpi_metrics) ──
create table public.department_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  metric_key text not null check (metric_key in ('enrolments_closed', 'revenue')),
  target bigint not null check (target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, period, metric_key)
);

-- ── Personal KPI status logs (append-only; written on EVERY transition — §V) ──
create table public.personal_kpi_status_logs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.personal_kpis (id) on delete cascade,
  centre_id uuid not null references public.centres (id),
  from_status text check (from_status in ('pending', 'approved', 'rejected')),  -- NULL at creation
  to_status text not null check (to_status in ('pending', 'approved', 'rejected')),
  changed_by_id uuid not null references public.employees (id),
  note text,
  changed_at timestamptz not null default now()
);

-- ── Indexes on policy-referenced / hot columns ──
create index idx_personal_kpis_consultant on public.personal_kpis (consultant_id);
create index idx_personal_kpis_centre on public.personal_kpis (centre_id);
create index idx_personal_kpis_period on public.personal_kpis (period);
create index idx_personal_kpis_status on public.personal_kpis (approval_status);
create index idx_dept_targets_period on public.department_kpi_targets (period);
create index idx_kpi_status_logs_entry on public.personal_kpi_status_logs (entry_id);
