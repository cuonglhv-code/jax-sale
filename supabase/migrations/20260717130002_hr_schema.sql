-- HR module (slice 004), T006 — the ten HR tables (data-model §2–8). One request table drives all
-- nine form types (the engine); type-specific fields live in `payload` jsonb. Enum VALUES are the
-- contract, enforced with CHECK (no native pg enum — matches employees.app_role). DB snake_case ↔
-- app camelCase at the service boundary. RLS + grants land in 20260717130003_hr_rls.sql.

-- ── Configuration & reference (network-wide; Pattern B write in RLS) ──────────

-- leave_policy_config — one active row per leave-year (statutory figures; HR-editable; §3).
create table public.leave_policy_config (
  id uuid primary key default gen_random_uuid(),
  leave_year int not null unique,
  annual_baseline_days numeric(4, 1) not null,
  seniority_extra_days_per_years numeric(4, 1) not null default 1.0,
  seniority_years_step int not null default 5,
  leave_year_start text not null default 'calendar' check (leave_year_start in ('calendar')),
  working_week int[] not null default '{1,2,3,4,5}',           -- ISO weekdays counted as working
  notice_days int not null default 0,
  carryover_enabled boolean not null default false,
  carryover_cap_days numeric(4, 1),
  medical_doc_retention_days int not null default 365,
  part_time_prorate boolean not null default true,
  updated_by uuid references public.employees (id),
  updated_at timestamptz not null default now()
);

-- leave_event_allowance — statutory paid-personal-leave allowances per event (FR-007; §3).
create table public.leave_event_allowance (
  id uuid primary key default gen_random_uuid(),
  event text not null unique check (
    event in ('marriage_self', 'marriage_child', 'bereavement', 'other')
  ),
  allowance_days numeric(4, 1) not null default 0,
  paid boolean not null default true
);

-- public_holiday — network-wide holiday calendar; excluded from working-day counts (FR-015; §3).
create table public.public_holiday (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null
);

-- doc_type_policy — accepted attachment types/size per request type (FR-031; §3).
create table public.doc_type_policy (
  id uuid primary key default gen_random_uuid(),
  request_type text not null unique check (
    request_type in (
      'annual_leave', 'sick_leave', 'personal_leave', 'unpaid_leave', 'shift_swap',
      'overtime', 'salary_advance', 'purchase', 'business_travel'
    )
  ),
  max_size_bytes int not null,
  allowed_mime text[] not null,
  required boolean not null default false
);

-- ── Timetable (minimal; Pattern A centre-partitioned) ─────────────────────────

-- class — recurring class definition; a "session" is computed (class_id, session_date), never stored (§4).
create table public.class (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres (id),
  course_label text not null,
  teacher_id uuid not null references public.employees (id),
  weekday int not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true
);

-- ── Core request table — all nine types (§5) ──────────────────────────────────
create table public.hr_request (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (
    request_type in (
      'annual_leave', 'sick_leave', 'personal_leave', 'unpaid_leave', 'shift_swap',
      'overtime', 'salary_advance', 'purchase', 'business_travel'
    )
  ),
  submitter_id uuid not null references public.employees (id),
  centre_id uuid not null references public.centres (id),
  status text not null default 'pending' check (
    status in ('pending', 'awaiting_cover', 'approved', 'rejected', 'cancelled', 'withdrawn')
  ),
  start_date date,
  end_date date,
  day_part text check (day_part is null or day_part in ('full', 'morning', 'afternoon')),
  working_days numeric(4, 1),
  amount numeric(12, 2),                       -- money forms; sensitive (§12, restricted read)
  payload jsonb not null default '{}'::jsonb,  -- type-specific fields (Zod-validated per type, §10)
  decided_by uuid references public.employees (id),
  decided_at timestamptz,
  decision_reason text,
  supersedes_id uuid references public.hr_request (id),   -- correction link (FR-041)
  created_at timestamptz not null default now()
);

-- hr_request_status_history — append-only; a from_status=null row is written at creation (§5).
create table public.hr_request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hr_request (id) on delete cascade,
  from_status text check (
    from_status is null
    or from_status in ('pending', 'awaiting_cover', 'approved', 'rejected', 'cancelled', 'withdrawn')
  ),
  to_status text not null check (
    to_status in ('pending', 'awaiting_cover', 'approved', 'rejected', 'cancelled', 'withdrawn')
  ),
  changed_by uuid not null references public.employees (id),
  reason text,
  created_at timestamptz not null default now()
);

-- ── Cover assignments (§6) ────────────────────────────────────────────────────
create table public.cover_assignment (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hr_request (id) on delete cascade,
  class_id uuid not null references public.class (id),
  session_date date not null,
  nominee_id uuid not null references public.employees (id),
  status text not null default 'nominated' check (
    status in ('nominated', 'accepted', 'declined', 'released')
  ),
  responded_at timestamptz
);

-- ── Attachments (§7; restricted, storage-backed) ──────────────────────────────
create table public.request_attachment (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.hr_request (id) on delete cascade,
  storage_path text not null unique,           -- path in the private bucket; encodes request_id
  mime_type text not null,
  size_bytes int not null,
  is_medical boolean not null default false,
  uploaded_by uuid not null references public.employees (id),
  purge_after date,                            -- retention deadline (FR-033a)
  created_at timestamptz not null default now()
);

-- ── Annual-leave ledger (§8; restricted read; guarded write) ──────────────────
-- remaining = entitlement_days + opening_adjustment_days − consumed_days (derived, never stored).
create table public.leave_balance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  leave_year int not null,
  entitlement_days numeric(4, 1) not null default 0,
  consumed_days numeric(4, 1) not null default 0,
  opening_adjustment_days numeric(4, 1) not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_year)
);

-- ── Indexes on policy-referenced / hot columns (§5 + queue/report/conflict paths) ──
create index idx_hr_request_centre_status on public.hr_request (centre_id, status);
create index idx_hr_request_submitter on public.hr_request (submitter_id, created_at);
create index idx_hr_request_type_status on public.hr_request (request_type, status);
create index idx_hr_request_dates on public.hr_request (start_date, end_date);
create index idx_hr_history_request on public.hr_request_status_history (request_id);
create index idx_cover_request on public.cover_assignment (request_id);
create index idx_cover_nominee on public.cover_assignment (nominee_id);
create index idx_cover_class_session on public.cover_assignment (class_id, session_date);
create index idx_attachment_request on public.request_attachment (request_id);
create index idx_class_centre on public.class (centre_id);
create index idx_class_teacher on public.class (teacher_id);
create index idx_leave_balance_employee on public.leave_balance (employee_id);
