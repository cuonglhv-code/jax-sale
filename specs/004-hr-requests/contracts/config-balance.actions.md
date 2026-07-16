# Contract: Leave Config, Entitlement, Balance & Reporting

## updateConfig — `update-config.ts` (key: `hrConfig.manage`; super_admin only)

CRUD over the HR-editable statutory/policy stores (FR-030): `leave_policy_config`,
`leave_event_allowance`, `public_holiday`, `doc_type_policy`. Each write is a guarded RPC that emits
`write_audit_log("hrConfig.update", …, {table, changedFields})` (record which fields changed, not
values). Pattern B (broad read — policy is not secret; super_admin write). A `leave_policy_config`
change to accrual/working-week triggers `recompute_entitlement` for affected employees for the current
leave year.

⚠ All shipped statutory figures are **unverified starting points requiring HR/legal sign-off** before
launch (surfaced in the config UI as a banner).

## Entitlement & balance

- `recompute_entitlement(employeeId, year)` — derives `entitlement_days = baseline + seniority
  accrual(hire_date, step) `, pro-rated for mid-year `hire_date` and (if `part_time_prorate`) by
  `employment_type`. Idempotent; writes `leave_balance.entitlement_days`.
- **adjustOpeningBalance** — `adjust-balance.ts` (key: `leaveBalance.adjust`; super_admin):
  `{ employeeId, year, deltaDays, reason }` → `adjust_opening_balance(...)`; audited (FR-047). This is
  the only manual balance mutation (no historical migration — start-from-zero).
- Consumption/restoration are **not** separate actions — they happen inside `approve_request` /
  `cancel_or_withdraw_request` (data-model §11). No app code writes `consumed_days` directly.

**Reads**: `useLeaveBalance` (own; manager/admin own-centre) shows `entitlement`, `consumed`,
`remaining` (computed), and history for the year (FR-011, US8).

## Reporting — `bao-cao/` (key: `hrReport.view`; centre_manager, super_admin)

Server-side aggregations (SQL, no N+1; paginated):
- **Leave taken** by employee / centre / period; **requests** by type & status; **outstanding balances**
  (FR-038) — all exportable (CSV; reuse `papaparse` planned in the stack).
- **Coverage view** (FR-039, SC-007): "who is off in a period and who is covering" — joins approved
  leave requests to their accepted `cover_assignment` sessions. Answers without contacting anyone.
- Scope: centre_manager sees own centre; super_admin sees network-wide (via `resolveEffectiveCentre`).
- Reports **never** include medical-doc contents — only `hasAttachment` (FR-033).
