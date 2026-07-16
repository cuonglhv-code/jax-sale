-- Foundation schema (spec data-model.md). App camelCase ↔ DB snake_case; enum VALUES are the
-- contract, enforced here with CHECK constraints. Every tenant table carries centre_id.

-- ── Centres (unit of tenancy) ────────────────────────────────────────────────
create table public.centres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  is_functional boolean not null default false
);

-- ── Departments (first-class, network-wide; flat, no centre_id — FR-024f) ─────
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ── Employees (1:1 with an auth user) ────────────────────────────────────────
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  app_role text not null check (
    app_role in ('super_admin', 'centre_manager', 'centre_admin', 'sale_consultant', 'teacher')
  ),
  centre_id uuid not null references public.centres (id),
  department_id uuid not null references public.departments (id),
  is_active boolean not null default true,
  avatar_color text not null default '#888888'
);

-- ── Tasks ────────────────────────────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id),
  assignee_id uuid not null references public.employees (id),
  department_id uuid not null references public.departments (id),
  description text not null check (length(trim(description)) > 0),
  "group" text not null check (
    "group" in (
      'GIANG_DAY', 'TUYEN_SINH', 'VAN_HANH_LOP', 'CHAM_SOC_HV',
      'SU_KIEN', 'HOP', 'MARKETING_TRUYEN_THONG', 'KHAC'
    )
  ),
  priority text not null check (priority in ('HIGH', 'MID', 'LOW')),
  deadline date not null,
  status text not null default 'TODO' check (
    status in ('TODO', 'DOING', 'DONE', 'BLOCK', 'RESCHEDULED', 'CANCELLED')
  ),
  source text not null check (source in ('ASSIGNED', 'SELF_CREATED', 'AD_HOC')),
  note text,
  created_by uuid not null references public.employees (id),
  created_at timestamptz not null default now()
);

-- ── Task status logs (append-only; written on EVERY transition — FR-021/022) ──
create table public.task_status_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  centre_id uuid not null references public.centres (id),
  from_status text check (
    from_status in ('TODO', 'DOING', 'DONE', 'BLOCK', 'RESCHEDULED', 'CANCELLED')
  ),
  to_status text not null check (
    to_status in ('TODO', 'DOING', 'DONE', 'BLOCK', 'RESCHEDULED', 'CANCELLED')
  ),
  changed_by_id uuid not null references public.employees (id),
  note text,
  changed_at timestamptz not null default now()
);

-- ── Audit log (general seam future modules reuse — FR-024g; append-only) ──────
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.employees (id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  centre_id uuid not null references public.centres (id),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes on every policy-referenced / hot column (research R2/R7) ──────────
create index idx_employees_centre on public.employees (centre_id);
create index idx_employees_auth_user on public.employees (auth_user_id);
create index idx_tasks_centre on public.tasks (centre_id);
create index idx_tasks_assignee on public.tasks (assignee_id);
create index idx_tasks_status on public.tasks (status);
create index idx_tasks_deadline on public.tasks (deadline);
create index idx_status_logs_task on public.task_status_logs (task_id);
create index idx_audit_centre on public.audit_log (centre_id);
