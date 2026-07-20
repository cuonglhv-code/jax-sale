-- Slice #003 — RLS for the KPI tables (contracts/rls-policies.md). personal_kpis uses the NEW tiered
-- read pattern (own → centre → network) — the §13-sanctioned own-row exception, stricter than the
-- foundation's broad read. department_kpi_targets = Pattern B (network reference, admin write). Status
-- logs are append-only. Claims read as subquery-cached (select auth.jwt() ->> '...').

grant select, insert, update, delete on public.personal_kpis to authenticated;
grant select, insert, update, delete on public.department_kpi_targets to authenticated;
grant select, insert on public.personal_kpi_status_logs to authenticated;   -- append-only
grant all on public.personal_kpis, public.department_kpi_targets,
  public.personal_kpi_status_logs to service_role;

-- ── personal_kpis — TIERED read; centre-narrow write ──
alter table public.personal_kpis enable row level security;

create policy "pkpi_select_tiered" on public.personal_kpis for select to authenticated
  using (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or (
      (select auth.jwt() ->> 'app_role') in ('centre_manager', 'centre_admin')
      and centre_id::text = (select auth.jwt() ->> 'centre_id')
    )
    or (
      (select auth.jwt() ->> 'app_role') = 'sale_consultant'
      and consultant_id::text = (select auth.jwt() ->> 'employee_id')
    )
  );

create policy "pkpi_insert_own" on public.personal_kpis for insert to authenticated
  with check (
    centre_id::text = (select auth.jwt() ->> 'centre_id')
    and (
      (select auth.jwt() ->> 'app_role') in ('centre_manager', 'centre_admin')
      or (
        (select auth.jwt() ->> 'app_role') = 'sale_consultant'
        and consultant_id::text = (select auth.jwt() ->> 'employee_id')
      )
    )
  );

create policy "pkpi_update_scoped" on public.personal_kpis for update to authenticated
  using (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or (
      centre_id::text = (select auth.jwt() ->> 'centre_id')
      and (
        (select auth.jwt() ->> 'app_role') in ('centre_manager', 'centre_admin')
        or (
          (select auth.jwt() ->> 'app_role') = 'sale_consultant'
          and consultant_id::text = (select auth.jwt() ->> 'employee_id')
        )
      )
    )
  )
  with check (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or centre_id::text = (select auth.jwt() ->> 'centre_id')
  );
-- No DELETE policy: KPI rows are not deleted in this slice.

-- ── department_kpi_targets — Pattern B: management read, super_admin write ──
alter table public.department_kpi_targets enable row level security;
create policy "dkpi_select_mgmt" on public.department_kpi_targets for select to authenticated
  using ((select auth.jwt() ->> 'app_role') in ('super_admin', 'centre_manager', 'centre_admin'));
create policy "dkpi_write_admin" on public.department_kpi_targets for all to authenticated
  using ((select auth.jwt() ->> 'app_role') = 'super_admin')
  with check ((select auth.jwt() ->> 'app_role') = 'super_admin');

-- ── personal_kpi_status_logs — tiered read via centre_id; append-only insert ──
alter table public.personal_kpi_status_logs enable row level security;
create policy "pkpi_logs_select_tiered" on public.personal_kpi_status_logs for select to authenticated
  using (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or (
      centre_id::text = (select auth.jwt() ->> 'centre_id')
      and (select auth.jwt() ->> 'app_role') in ('centre_manager', 'centre_admin', 'sale_consultant')
    )
  );
create policy "pkpi_logs_insert_own_centre" on public.personal_kpi_status_logs for insert to authenticated
  with check (
    (select auth.jwt() ->> 'app_role') = 'super_admin'
    or centre_id::text = (select auth.jwt() ->> 'centre_id')
  );
