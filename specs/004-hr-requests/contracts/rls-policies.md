# Contract: RLS Policies (HR Requests)

Extends `specs/001-foundation-auth-tenancy/contracts/rls-policies.md`. Reuses the claim-reading idiom
`(select auth.jwt() ->> '<claim>')` wrapped in a subquery for per-statement caching. **The database is
the authoritative boundary** — a buggy action that forgets its gate still cannot cross these policies.

Helper predicates (inlined per policy, no shared SQL function — matching the existing no-helper
convention):
- `is_super_admin` := `(select auth.jwt() ->> 'app_role') = 'super_admin'`
- `my_centre` := `(select auth.jwt() ->> 'centre_id')`
- `my_employee` := `(select auth.jwt() ->> 'employee_id')`
- `is_centre_manager_here(c)` := `(select auth.jwt() ->> 'app_role') = 'centre_manager' AND c::text = my_centre`

---

## `hr_request` — RESTRICTED read (Pattern C variant), centre-narrow write

```sql
alter table public.hr_request enable row level security;

-- READ: own submissions, OR centre_manager of the request's centre, OR super_admin.
create policy "hr_request_select_scoped" on public.hr_request for select to authenticated
using (
  submitter_id::text = (select auth.jwt() ->> 'employee_id')
  or (select auth.jwt() ->> 'app_role') = 'super_admin'
  or ( (select auth.jwt() ->> 'app_role') = 'centre_manager'
       and centre_id::text = (select auth.jwt() ->> 'centre_id') )
);

-- INSERT: submitter creates only in own centre, only for self.
create policy "hr_request_insert_own" on public.hr_request for insert to authenticated
with check (
  centre_id::text = (select auth.jwt() ->> 'centre_id')
  and submitter_id::text = (select auth.jwt() ->> 'employee_id')
);

-- UPDATE (decision/status): centre_manager of the centre, or super_admin. Actual transitions go
-- through guarded SECURITY INVOKER functions; this policy bounds any direct update too.
create policy "hr_request_update_decider" on public.hr_request for update to authenticated
using (
  (select auth.jwt() ->> 'app_role') = 'super_admin'
  or ( (select auth.jwt() ->> 'app_role') = 'centre_manager'
       and centre_id::text = (select auth.jwt() ->> 'centre_id') )
  or submitter_id::text = (select auth.jwt() ->> 'employee_id')   -- own cancel/withdraw
)
with check ( centre_id::text = (select auth.jwt() ->> 'centre_id') or (select auth.jwt() ->> 'app_role') = 'super_admin' );
-- no DELETE policy: requests are never hard-deleted (immutability; cancelled/withdrawn are statuses).
```

> **Note (peers cannot read others' requests):** the SELECT policy deliberately omits the broad
> `using (true)` that `tasks` uses — this is the restricted-read decision (plan Complexity Tracking, R5).
> **Sensitive columns** (`amount`, medical pointer): a same-centre peer is already excluded by the row
> policy; the additional approver-only narrowing of `amount` vs the submitter is enforced at the service
> read layer (the queue projection) and by never exposing `amount` in broad projections.

## `hr_request_status_history` — read = parent scope; insert-only

```sql
create policy "hr_history_select_scoped" on public.hr_request_status_history for select to authenticated
using ( exists (select 1 from public.hr_request r where r.id = request_id) );  -- parent RLS filters visibility
create policy "hr_history_insert" on public.hr_request_status_history for insert to authenticated with check (true);
-- writes only occur inside guarded fns; no update/delete (append-only).
```

## `cover_assignment` — request scope ∪ nominee; guarded write

```sql
create policy "cover_select_scoped" on public.cover_assignment for select to authenticated
using (
  nominee_id::text = (select auth.jwt() ->> 'employee_id')
  or exists (select 1 from public.hr_request r where r.id = request_id)   -- inherits request visibility
);
create policy "cover_write" on public.cover_assignment for all to authenticated
using ( true ) with check ( true );   -- mutations only via guarded fns; RLS on hr_request/centre confines reach
```

## `leave_balance` — own-row read (like `personal_kpis`) + manager/admin; guarded write only

```sql
create policy "balance_select_scoped" on public.leave_balance for select to authenticated
using (
  employee_id::text = (select auth.jwt() ->> 'employee_id')
  or (select auth.jwt() ->> 'app_role') = 'super_admin'
  or exists ( select 1 from public.employees e
              where e.id = leave_balance.employee_id
                and e.centre_id::text = (select auth.jwt() ->> 'centre_id')
                and (select auth.jwt() ->> 'app_role') = 'centre_manager' )
);
-- INSERT/UPDATE: no direct policy for `authenticated` beyond guarded fns; consumed_days is only ever
-- written inside approve_request / cancel_or_withdraw_request (SECURITY INVOKER, centre-confined).
```

## Config & reference — Pattern B (broad read; super_admin write)

`leave_policy_config`, `leave_event_allowance`, `public_holiday`, `doc_type_policy`:
```sql
create policy "<t>_select_all" on public.<t> for select to authenticated using (true);
create policy "<t>_write_admin" on public.<t> for all to authenticated
using ((select auth.jwt() ->> 'app_role') = 'super_admin')
with check ((select auth.jwt() ->> 'app_role') = 'super_admin');
```

## `class` (timetable) — Pattern A (broad read; own-centre write)

```sql
create policy "class_select_all" on public.class for select to authenticated using (true);
create policy "class_write_own_centre" on public.class for all to authenticated
using ( centre_id::text = (select auth.jwt() ->> 'centre_id')
        or (select auth.jwt() ->> 'app_role') = 'super_admin' )
with check ( centre_id::text = (select auth.jwt() ->> 'centre_id')
        or (select auth.jwt() ->> 'app_role') = 'super_admin' );
```

## `request_attachment` (metadata) — approver/super_admin (medical); uploader own

See [storage-policies.md](./storage-policies.md) for the object-level policy. Metadata row:
```sql
create policy "attachment_select_scoped" on public.request_attachment for select to authenticated
using (
  uploaded_by::text = (select auth.jwt() ->> 'employee_id')                    -- own upload
  or (select auth.jwt() ->> 'app_role') = 'super_admin'                        -- HR
  or exists ( select 1 from public.hr_request r
              where r.id = request_id
                and (select auth.jwt() ->> 'app_role') = 'centre_manager'
                and r.centre_id::text = (select auth.jwt() ->> 'centre_id') )  -- approver role of centre
);
```

## Isolation proofs (tests) — Principle IV

Each policy above ships with a live-local-DB test proving the negative case:
- A `teacher` of centre A **cannot** SELECT a `sale_consultant`'s `hr_request` in centre A (peer read
  blocked) nor any request in centre B.
- A `centre_manager` of centre A **cannot** read/decide a request in centre B.
- A peer **cannot** read another employee's `leave_balance` or `request_attachment`.
- Every guarded mutation has a permission-rejection test (wrong role → `ForbiddenError`).
