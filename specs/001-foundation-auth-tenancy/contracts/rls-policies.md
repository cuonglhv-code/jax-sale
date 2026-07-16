# Contract: RLS Policies (Layer 3 — authoritative tenancy)

The database is the authoritative tenant boundary (constitution Principle II, FR-013, SC-003). Every
tenant table below has RLS **enabled** and the policy set specified. Policies target `TO
authenticated`, read `centre_id` from the JWT claim, and wrap the claim in a subquery
`(select auth.jwt() ->> 'centre_id')` for per-statement caching (research R2). Grants: `authenticated`
gets SELECT/INSERT/UPDATE/DELETE; `service_role` retained for admin/seed.

**Isolation contract (SC-002/SC-003):** for every tenant table, a user of centre A can neither read
private-scoped centre-B data (where the table is not network-wide readable) nor
INSERT/UPDATE/DELETE any centre-B row — proven by test against the live local DB, even if an app-layer
permission check is bypassed (SC-003).

---

## Pattern A — broad-read, centre-narrow-write (Task, TaskStatusLog, Employee)

```
-- SELECT: permissive network-wide read (broad read; oversight)
create policy "<t>_select_all" on <t>
  for select to authenticated using ( true );

-- INSERT: only into caller's own centre
create policy "<t>_insert_own_centre" on <t>
  for insert to authenticated
  with check ( (select auth.jwt() ->> 'centre_id') = centre_id::text );

-- UPDATE: only rows in caller's centre, and result stays in caller's centre
create policy "<t>_update_own_centre" on <t>
  for update to authenticated
  using ( (select auth.jwt() ->> 'centre_id') = centre_id::text )
  with check ( (select auth.jwt() ->> 'centre_id') = centre_id::text );

-- DELETE: only rows in caller's centre
create policy "<t>_delete_own_centre" on <t>
  for delete to authenticated
  using ( (select auth.jwt() ->> 'centre_id') = centre_id::text );
```

Applies to: **Task**, **TaskStatusLog** (carries denormalized `centre_id`), **Employee**.
Index `centre_id` (and `assignee_id`, `status`, `deadline` on Task) — every policy-referenced column
(research R2).

> **Teacher own-assigned scope** is enforced at the **app layer** (`mine = true` forces
> `assignee_id = self`), not RLS — because the "broad read" property is intentional and teachers'
> restriction is a UX/product scope, not a tenancy boundary. (FR-017.)

## Pattern B — network-wide reference, admin-managed writes (Centre, Department)

```
create policy "<t>_select_all" on <t>
  for select to authenticated using ( true );
-- writes restricted to elevated/admin roles; Department has NO centre_id (network-wide entity)
```

Department has no `centre_id` (FR-024f) — it is not centre-partitioned; only network-wide/admin roles
may write it. Centre likewise reference data.

## Pattern C — elevated-read audit trail (AuditLogEntry)

```
-- read restricted (audit is not broadly readable); scoped to caller's centre + elevated roles
create policy "audit_select_scoped" on audit_log
  for select to authenticated
  using ( (select auth.jwt() ->> 'centre_id') = centre_id::text );  -- refine to elevated roles as needed
-- INSERT only via the audit write path (service/function); no client UPDATE/DELETE (append-only)
```

Audit entries are append-only; no UPDATE/DELETE policy is granted (immutability). Insert happens
through the audit write function/service.

---

## Access-token hook grants (research R1)

```
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- the employee table the hook reads for role/centre/employee_id:
grant all on table public.employees to supabase_auth_admin;
revoke all on table public.employees from authenticated, anon, public;  -- (then re-grant SELECT-all via policy above)
create policy "employees_authadmin_read" on public.employees
  for select to supabase_auth_admin using ( true );
```

The hook is **not** `security definer` (research R1). Any later cross-centre write function IS
`security definer` with `set search_path = ''`, in a private schema, re-checking the caller's centre
(research R4) — not needed in this slice.

---

## Guarded-write functions (atomicity — research R3)

- `change_task_status(task_id, target?, note?)` — resolves next status + updates task + inserts
  `task_status_log` in one function (FR-021).
- Task creation writes task + initial `null → TODO` log atomically (FR-022).
- `write_audit_log(actor_id, action, entity_type, entity_id, centre_id, metadata?)` — the audit seam
  (FR-024g).
