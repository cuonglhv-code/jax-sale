-- Layer 3 — Row-Level Security (authoritative tenancy). Broad network-wide SELECT, centre-confined
-- writes. Claims read from the JWT and wrapped in a subquery for per-statement caching (research R2).
-- Contracts: contracts/rls-policies.md.

-- Grants: authenticated is the app role; service_role bypasses RLS (admin/seed only).
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ── Pattern B — network-wide reference (Centre, Department): broad read, admin write ──
alter table public.centres enable row level security;
create policy "centres_select_all" on public.centres for select to authenticated using (true);
create policy "centres_write_admin" on public.centres for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

alter table public.departments enable row level security;
create policy "departments_select_all" on public.departments for select to authenticated using (true);
create policy "departments_write_admin" on public.departments for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

-- ── Pattern A — broad read, centre-narrow write (Employee) ────────────────────
alter table public.employees enable row level security;
create policy "employees_select_all" on public.employees for select to authenticated using (true);
create policy "employees_insert_own_centre" on public.employees for insert to authenticated
  with check (centre_id::text = (select auth.jwt() ->> 'centre_id'));
create policy "employees_update_own_centre" on public.employees for update to authenticated
  using (centre_id::text = (select auth.jwt() ->> 'centre_id'))
  with check (centre_id::text = (select auth.jwt() ->> 'centre_id'));
create policy "employees_delete_own_centre" on public.employees for delete to authenticated
  using (centre_id::text = (select auth.jwt() ->> 'centre_id'));

-- ── Pattern A — Tasks ─────────────────────────────────────────────────────────
alter table public.tasks enable row level security;
create policy "tasks_select_all" on public.tasks for select to authenticated using (true);
create policy "tasks_insert_own_centre" on public.tasks for insert to authenticated
  with check (centre_id::text = (select auth.jwt() ->> 'centre_id'));
create policy "tasks_update_own_centre" on public.tasks for update to authenticated
  using (centre_id::text = (select auth.jwt() ->> 'centre_id'))
  with check (centre_id::text = (select auth.jwt() ->> 'centre_id'));
create policy "tasks_delete_own_centre" on public.tasks for delete to authenticated
  using (centre_id::text = (select auth.jwt() ->> 'centre_id'));

-- ── Pattern A — Task status logs (append-only in practice: no update/delete) ──
alter table public.task_status_logs enable row level security;
create policy "status_logs_select_all" on public.task_status_logs for select to authenticated using (true);
create policy "status_logs_insert_own_centre" on public.task_status_logs for insert to authenticated
  with check (centre_id::text = (select auth.jwt() ->> 'centre_id'));

-- ── Pattern C — Audit log (elevated + own-centre read; append-only) ───────────
alter table public.audit_log enable row level security;
create policy "audit_select_scoped" on public.audit_log for select to authenticated
  using (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or (
      centre_id::text = (select auth.jwt() ->> 'centre_id')
      and (select auth.jwt() ->> 'app_role') in ('centre_manager', 'centre_admin')
    )
  );
create policy "audit_insert_own_centre" on public.audit_log for insert to authenticated
  with check (centre_id::text = (select auth.jwt() ->> 'centre_id'));
