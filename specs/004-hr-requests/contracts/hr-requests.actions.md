# Contract: HR Request Server Actions (submit · decide · cancel/withdraw · cover)

All actions are Next.js Server Actions under `src/app/actions/hr/*`, the **sole** mutation entry
points. Every one follows the canonical pipeline (Constitution III) — identical shape to
`create-task.ts`:

```ts
export async function <action>(raw: unknown): Promise<ActionResult<T>> {
  return withError(async () => {
    const supabase = await createServerSupabaseClient();
    const claims = await assertPermission(supabase, "<key>");   // auth + RBAC
    const input = <zodSchema>.parse(raw);                       // boundary validation
    return <serviceCore>(supabase, claims, input);              // domain (guarded RPC + audit + email)
  });
}
```

`ActionResult<T> = { data: T } | { error: string }`. Errors: `UnauthenticatedError` / `ForbiddenError`
/ `DomainError` / `ZodError` → friendly Vietnamese via `friendlyMessage`. No client-supplied
role/centre is ever trusted — identity comes from verified claims.

---

## submitRequest — `submit-request.ts` (key: `hrRequest.submit`; all roles)

**Input** (`schemas/hr/submit.ts`): `{ type: RequestType, payload: <per-type> }`. The action selects
`FormDefinition[type]` and validates `payload` with that definition's schema (one engine, FR-002).

**Service `submitRequestCore`**:
1. Resolve `FormDefinition` by `type`.
2. Type validation: leave-family → valid date range, `day_part`, notice-days advisory warning;
   `sick`/`personal(event)` → documentation required flag; money forms → `amount > 0`.
3. `conflictScoped` types → run the conflict resolver (`lib/hr/conflict.ts`) for `(submitter, range)`;
   if affected sessions exist, **require** `payload.covers[]` naming a same-centre non-conflicting
   nominee per session (FR-018/020) — else `DomainError` "Vui lòng chọn giáo viên dạy thay".
4. `annual_leave` → compute `working_days` (`lib/hr/working-days.ts`) and read current balance to
   surface the over-balance **warning** (does not block — FR-012).
5. Call `create_hr_request_with_log(...)` (atomic: request + `from_status=null` history row +
   `cover_assignment` rows). Status = `awaiting_cover` if any cover unaccepted, else `pending`.
6. `write_audit_log("hrRequest.submit", "hr_request", id, {type})`.
7. Non-fatal email → approver(s) of the centre (R6).

**Returns** `HrRequest`. **Guarantees**: centre = submitter's centre (from claims, not input); balance
untouched (consume-on-approval only).

---

## decideRequest — `decide-request.ts` (key: `hrRequest.decide`; centre_manager + super_admin)

**Input**: `{ requestId, decision: "approve" | "reject", reason?: string }`. `reject` requires non-empty
`reason` (FR-027).

**Service `decideRequestCore`** → routes to the guarded RPC:
- **approve** → `approve_request(requestId, actor)`:
  - Forbids self-approval; a centre_manager's own request / absent-coverage is routed to super_admin
    (app-checked before the RPC; RPC also re-asserts `submitter_id <> actor`) (FR-026).
  - Requires all `cover_assignment` for the request to be `accepted` (else `DomainError`) (FR-019).
  - `annual_leave`: `SELECT … FOR UPDATE` on `leave_balance(employee, year)` → recompute `working_days`
    + remaining against **current** balance (FR-012) → `consumed_days += days` (allowed to go negative
    only as a recorded discretionary over-draw) → flip `pending → approved`.
  - status-history row + `write_audit_log("hrRequest.approve", …, {days, overdraw?})`.
  - money form → non-fatal email to accounting (super_admin) (FR-025).
  - Idempotent: precondition `status='pending'`; a second call no-ops.
- **reject** → `reject_request(requestId, actor, reason)`: flip `pending → rejected`; history + audit;
  no balance change; email submitter with reason.

**Returns** updated `HrRequest`. **Guarantees**: restricted to own-centre requests (RLS + claims); the
manager acts on a **freshly recomputed** balance impact.

---

## cancelOrWithdraw — `cancel-request.ts` (key: `hrRequest.cancel`; own request only)

**Input**: `{ requestId }`. App-checks `request.submitter_id === claims.employeeId`.

**Service** → `cancel_or_withdraw_request(requestId, actor)`:
- `pending`/`awaiting_cover` → `cancelled`; `approved` → `withdrawn`.
- If the request had consumed annual-leave balance, **restore** it atomically (FR-028).
- Releases any `cover_assignment` (→ `released`).
- history + `write_audit_log("hrRequest.cancel"|"hrRequest.withdraw", …)`; non-fatal email to approver.

---

## respondCover — `respond-cover.ts` (key: `cover.respond`; nominee only)

**Input**: `{ coverId, accept: boolean }`. App-checks `cover.nominee_id === claims.employeeId`.

**Service** → `respond_cover(coverId, accept)`:
- `accept` → re-check the nominee is not now hard-conflicting (FR-020); set `accepted`; if all covers on
  the request are accepted, move request `awaiting_cover → pending`.
- `decline` → set `declined`; request returns to the submitter for re-nomination (stays
  `awaiting_cover`); notify submitter.
- Post-approval decline (edge case) → flag request for re-resolution (FR-022); notify manager +
  submitter.
- history/audit + non-fatal email.

---

## Read queries (TanStack Query hooks; not mutations)

Follow the `useTasks` key-factory + discriminated-union-unwrap pattern. All paginated (`Paginated<T>`):
- `useMyRequests(filter)` — submitter's own (any status).
- `useApprovalQueue()` — `centre_id = mine AND status IN (pending, awaiting_cover)`, sorted soonest-start
  first; row includes who/what/when, **freshly computed** balance impact, affected sessions, cover
  status, `hasAttachment` boolean (never the attachment itself — FR-033).
- `useLeaveBalance(employeeId?)` — own by default; manager/admin may pass an own-centre employee.
