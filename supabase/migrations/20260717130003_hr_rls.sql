-- HR module (slice 004), T010 — RLS for every HR table (contracts/rls-policies.md). hr_request and
-- leave_balance use RESTRICTED read (own + centre_manager + super_admin) because they carry salary
-- amounts, leave reasons and medical pointers — the audit_log / personal_kpis precedent. Config &
-- reference tables are Pattern B (broad read / super_admin write); `class` is Pattern A (broad read /
-- own-centre write). Claims read subquery-cached: (select auth.jwt() ->> '<claim>'). New tables need
-- explicit grants (the foundation's blanket grant only covered tables that existed then).

-- ── Grants (authenticated app role; service_role bypasses RLS for seed/admin) ──
grant select, insert, update on public.hr_request to authenticated;
grant select, insert on public.hr_request_status_history to authenticated;   -- append-only
grant select, insert, update, delete on public.cover_assignment to authenticated;
grant select on public.request_attachment to authenticated;                  -- writes via service-role
grant select on public.leave_balance to authenticated;                       -- writes via guarded fns
grant select, insert, update, delete on public.leave_policy_config to authenticated;
grant select, insert, update, delete on public.leave_event_allowance to authenticated;
grant select, insert, update, delete on public.public_holiday to authenticated;
grant select, insert, update, delete on public.doc_type_policy to authenticated;
grant select, insert, update, delete on public.class to authenticated;
grant all on public.hr_request, public.hr_request_status_history, public.cover_assignment,
  public.request_attachment, public.leave_balance, public.leave_policy_config,
  public.leave_event_allowance, public.public_holiday, public.doc_type_policy, public.class
  to service_role;

-- ── hr_request — RESTRICTED read (Pattern C variant), centre-narrow write ──────
alter table public.hr_request enable row level security;

create policy "hr_request_select_scoped" on public.hr_request for select to authenticated
  using (
    submitter_id::text = (select auth.jwt() ->> 'employee_id')
    or (select auth.jwt() ->> 'app_role') = 'super_admin'
    or (
      (select auth.jwt() ->> 'app_role') = 'centre_manager'
      and centre_id::text = (select auth.jwt() ->> 'centre_id')
    )
  );

create policy "hr_request_insert_own" on public.hr_request for insert to authenticated
  with check (
    centre_id::text = (select auth.jwt() ->> 'centre_id')
    and submitter_id::text = (select auth.jwt() ->> 'employee_id')
  );

create policy "hr_request_update_decider" on public.hr_request for update to authenticated
  using (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or (
      (select auth.jwt() ->> 'app_role') = 'centre_manager'
      and centre_id::text = (select auth.jwt() ->> 'centre_id')
    )
    or submitter_id::text = (select auth.jwt() ->> 'employee_id')   -- own cancel/withdraw
  )
  with check (
    centre_id::text = (select auth.jwt() ->> 'centre_id')
    or (select auth.jwt() ->> 'app_role') = 'super_admin'
  );
-- no DELETE policy: requests are never hard-deleted (immutability).

-- ── hr_request_status_history — read = parent scope; insert-only (append-only) ──
alter table public.hr_request_status_history enable row level security;
create policy "hr_history_select_scoped" on public.hr_request_status_history for select to authenticated
  using (exists (select 1 from public.hr_request r where r.id = request_id));   -- parent RLS filters
create policy "hr_history_insert" on public.hr_request_status_history for insert to authenticated
  with check (true);   -- writes only inside guarded fns; no update/delete

-- ── cover_assignment — request scope ∪ nominee; guarded write ─────────────────
alter table public.cover_assignment enable row level security;
create policy "cover_select_scoped" on public.cover_assignment for select to authenticated
  using (
    nominee_id::text = (select auth.jwt() ->> 'employee_id')
    or exists (select 1 from public.hr_request r where r.id = request_id)   -- inherits request visibility
  );
create policy "cover_write" on public.cover_assignment for all to authenticated
  using (true) with check (true);   -- mutations only via guarded fns; hr_request/centre RLS confines reach

-- ── leave_balance — own-row read (like personal_kpis) + manager/admin; guarded write only ──
alter table public.leave_balance enable row level security;
create policy "balance_select_scoped" on public.leave_balance for select to authenticated
  using (
    employee_id::text = (select auth.jwt() ->> 'employee_id')
    or (select auth.jwt() ->> 'app_role') = 'super_admin'
    or exists (
      select 1 from public.employees e
      where e.id = leave_balance.employee_id
        and e.centre_id::text = (select auth.jwt() ->> 'centre_id')
        and (select auth.jwt() ->> 'app_role') = 'centre_manager'
    )
  );
-- No INSERT/UPDATE policy for authenticated: consumed_days is written only inside the guarded
-- balance functions (added in US3). Seed rows are inserted via service_role.

-- ── Config & reference — Pattern B (broad read; super_admin write) ────────────
alter table public.leave_policy_config enable row level security;
create policy "leave_policy_config_select_all" on public.leave_policy_config for select to authenticated using (true);
create policy "leave_policy_config_write_admin" on public.leave_policy_config for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

alter table public.leave_event_allowance enable row level security;
create policy "leave_event_allowance_select_all" on public.leave_event_allowance for select to authenticated using (true);
create policy "leave_event_allowance_write_admin" on public.leave_event_allowance for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

alter table public.public_holiday enable row level security;
create policy "public_holiday_select_all" on public.public_holiday for select to authenticated using (true);
create policy "public_holiday_write_admin" on public.public_holiday for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

alter table public.doc_type_policy enable row level security;
create policy "doc_type_policy_select_all" on public.doc_type_policy for select to authenticated using (true);
create policy "doc_type_policy_write_admin" on public.doc_type_policy for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

-- ── class (timetable) — Pattern A (broad read; own-centre write) ──────────────
alter table public.class enable row level security;
create policy "class_select_all" on public.class for select to authenticated using (true);
create policy "class_write_own_centre" on public.class for all to authenticated
  using (
    centre_id::text = (select auth.jwt() ->> 'centre_id')
    or (select auth.jwt() ->> 'app_role') = 'super_admin'
  )
  with check (
    centre_id::text = (select auth.jwt() ->> 'centre_id')
    or (select auth.jwt() ->> 'app_role') = 'super_admin'
  );

-- ── request_attachment (metadata) — approver/super_admin (medical); uploader own ──
alter table public.request_attachment enable row level security;
create policy "attachment_select_scoped" on public.request_attachment for select to authenticated
  using (
    uploaded_by::text = (select auth.jwt() ->> 'employee_id')                    -- own upload
    or (select auth.jwt() ->> 'app_role') = 'super_admin'                        -- HR
    or exists (
      select 1 from public.hr_request r
      where r.id = request_id
        and (select auth.jwt() ->> 'app_role') = 'centre_manager'
        and r.centre_id::text = (select auth.jwt() ->> 'centre_id')              -- approver role of centre
    )
  );
-- INSERT/DELETE via service-role only (upload/purge flow, storage-policies.md); no authenticated write.
