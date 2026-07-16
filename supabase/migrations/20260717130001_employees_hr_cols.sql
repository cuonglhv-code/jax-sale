-- HR module (slice 004), T005 — extend public.employees with the HR attributes the leave-accrual
-- engine needs. Net-new columns (none existed). Enum VALUES are the contract, enforced with CHECK
-- (matching employees.app_role). Backfill keeps every existing seeded row valid.
--
-- Timestamp note: 20260716130001 is already taken by slice-003 (roadmap_records); this slice's
-- migrations start at 20260717130001 to avoid collision (today is 2026-07-17).

alter table public.employees
  add column if not exists hire_date date,
  add column if not exists employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time')),
  add column if not exists contract_type text
    check (contract_type is null or contract_type in ('indefinite', 'fixed_term', 'probation', 'seasonal'));

-- Backfill sensible defaults so pre-existing rows satisfy accrual assumptions.
-- employment_type is covered by its NOT NULL DEFAULT; give existing rows an indefinite contract and
-- a plausible hire_date (start of the current leave year) where unset.
update public.employees
  set contract_type = coalesce(contract_type, 'indefinite'),
      hire_date = coalesce(hire_date, date_trunc('year', current_date)::date);
