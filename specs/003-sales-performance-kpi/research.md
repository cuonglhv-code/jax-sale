# Research & Decision Log: Sales Performance & KPI Tracker

Phase 0 output. Resolves the spec's remaining Open Decisions and records the load-bearing design
choices (each: Decision / Rationale / Alternatives considered). No `NEEDS CLARIFICATION` remains.

---

## D-TIER — Tiered read enforcement (own → centre → network)

**Decision**: `personal_kpis` gets a **tiered SELECT RLS policy** (not the foundation's broad
`using(true)`): `super_admin` reads all; `centre_manager`/`centre_admin` read `centre_id = own`;
`sale_consultant` reads `consultant_id = own employee_id`; `teacher` reads nothing. Enforced at the
database, so a manipulated request cannot exceed its tier.

**Rationale**: Sales-performance/compensation data is sensitive; the spec (user's interview) chose
tiered visibility over broad read. Constitution §13 already makes `personal_kpis` **own-row**, so
tiering is the sanctioned exception to "reads are broad", not a deviation. Putting it in RLS (vs the
app layer) means even a raw query is confined — the constitution's "RLS is authoritative" rule.

**Alternatives considered**: (a) broad read + app-layer filtering — rejected: violates §13 own-row
and leaks under a raw query. (b) A single `using(true)` with column masking — rejected: complex,
still exposes row existence. (c) Teacher read-only own KPI — rejected per D-TEACHER (teachers have no
sales KPI).

---

## D-ACTUAL — "Actual-only" owner writes via a BEFORE UPDATE trigger

**Decision**: a `BEFORE UPDATE` trigger `enforce_actual_only` on `personal_kpis`. When the acting
role is `sale_consultant` (the owner path), the trigger permits a change to `actual` **only** — any
change to `target`, `approval_status`, `consultant_id`, `centre_id`, `period`, or `metric_key` raises
a Vietnamese exception. An `actual` change also forces `approval_status → 'pending'` and the trigger
inserts the `personal_kpi_status_logs` row for that transition. Manager target-writes and the guarded
approve/reject function are the only other writers.

**Rationale**: §13 mandates "actual-column-only, enforced by RLS + a BEFORE UPDATE trigger". RLS
alone is row-level (who), not column-level (which field) — the trigger supplies column-level
enforcement. Auto-forcing `pending` on edit implements the integrity rule "editing an approved actual
reverts it to pending" (AC-1.4/AC-7.5) at the database, so it cannot be bypassed by the app.

**Alternatives considered**: (a) column privileges (`GRANT UPDATE(actual)`) — rejected: Postgres
column grants can restrict the consultant but can't express "and also force status→pending + write a
log"; the trigger does both. (b) enforce in the service only — rejected: constitution requires DB
enforcement; a buggy service must still be safe. (c) separate `actuals` and `targets` tables —
rejected: §13 names one `personal_kpis` table holding both, with the trigger as the guard.

---

## D-APPROVAL — Approval lifecycle & atomic transitions

**Decision**: `personal_kpis.approval_status ∈ {pending, approved, rejected}`. Transitions:
create → `pending` (log `null→pending`); manager approve → `approved`; manager reject → `rejected`;
consultant edit (any state) → `pending`. approve/reject run through SECURITY-INVOKER plpgsql
functions `approve_personal_kpi(p_entry_id)` / `reject_personal_kpi(p_entry_id, p_note)` that lock
the row `for update`, assert it is `pending` and in the caller's centre, update status, and insert
the status-log **in one function call** — mirroring `change_task_status`. Only `approved` rows count
in aggregates/ranking/exports.

**Rationale**: user clarification (2026-07-16) chose manager approval. Constitution §V requires a
status-log on every transition and atomic compound writes; the guarded function gives both. Running
SECURITY INVOKER (not DEFINER) keeps RLS active, so a centre-A manager physically cannot approve a
centre-B row — no extra app check needed for isolation.

**Alternatives considered**: (a) approve via a plain UPDATE from the service — rejected: two round
trips (update + log insert) can partially fail; §V wants atomicity. (b) SECURITY DEFINER — rejected:
unnecessary (no cross-centre fan-out here) and would bypass the very RLS that enforces isolation.
(c) 2-state (`pending`/`approved`, no reject) — rejected: a manager needs to bounce a wrong figure
back; `rejected` + consultant-edit-to-pending gives a clean loop.

---

## D-AGG — Rollups & tiering for dashboards/leaderboards

**Decision**: dashboard and leaderboard aggregates are computed by **SECURITY-INVOKER SQL functions**
(`kpi_dashboard(p_period, p_scope)`, `kpi_leaderboard(p_period, p_metric, p_scope)`) that `GROUP BY`
over `personal_kpis` filtered to `approval_status = 'approved'`, joining `employees` for
`department_id`/names. Because they run as invoker, the tiered SELECT RLS auto-scopes the rows each
caller can sum — the same function returns own-only for a consultant, centre-only for a manager,
network for `super_admin`.

**Rationale**: constitution bans N+1 and mandates SQL `GROUP BY` for aggregations. `claims` lacks
`department_id`, so department grouping must join `employees` — done once in SQL, not per-row in TS.
RLS-INVOKER aggregation makes tiering automatic and impossible to under-enforce, and keeps one code
path for all tiers.

**Alternatives considered**: (a) fetch rows to TS and aggregate — rejected: N+1/over-fetch, and
would re-implement tiering in app code. (b) materialized views — rejected: premature at this scale;
adds refresh complexity. (c) pass the caller's tier as a function arg — rejected: trusting a
client-supplied scope; RLS already knows the tier from the JWT.

---

## D-EXPORT — Export format (resolves spec Open Decision, clarified)

**Decision**: **CSV + a simple branded PDF summary** (clarified 2026-07-16). CSV is built server-side
as a Vietnamese-headered string from the same tier-confined rows the dashboard shows. The PDF reuses
slice #002's `@react-pdf/renderer` + embedded Vietnamese-covering font (`fonts.ts`) for a one-page
summary. Both are generated from the caller's tier data only (AC-5.2).

**Rationale**: CSV serves analysis; PDF serves management sharing. Reusing #002's PDF stack avoids a
second rendering approach and the diacritic problem is already solved there (Montserrat coverage).

**Alternatives considered**: CSV-only (rejected — user wants a shareable summary); PDF-only (rejected
— loses analyzable data); a spreadsheet lib (rejected — CSV suffices, no dependency).

---

## D-ZERO — Target-of-zero handling (resolves spec Open Decision)

**Decision**: **reject a target of 0** at the Zod boundary and in the DB CHECK (`target > 0` when not
null) with a Vietnamese message.

**Rationale**: a 0 target makes attainment (`actual/target`) undefined and would be indistinguishable
from "not set" if coerced. "No target" is expressed by NULL (→ `not_set`); 0 is invalid, not a
sentinel. Keeps `not_set` (NULL) and `no_result` (approved actual 0 against a real target) cleanly
distinct.

**Alternatives considered**: treat 0 as "not set" — rejected: conflates two meanings and invites a
misleading UI; NULL already means "not set".

---

## D-TEACHER — Teacher scope (resolves spec Open Decision)

**Decision**: `/hieu-suat` is **hidden from `teacher`** in the nav/access matrix; `teacher` holds
none of the four KPI keys and reads no `personal_kpis` rows.

**Rationale**: `teacher` is not a sales role; there is no sales KPI for a teacher. Hiding it keeps
the nav honest (nav = access matrix) and avoids an empty, confusing surface.

**Alternatives considered**: read-only own KPI for teachers — rejected: no data would ever exist;
pure noise.

---

## D-PERIOD — Period model & locking (resolves spec Open Decision)

**Decision**: a period is a **calendar month** (`YYYY-MM`); quarter/year are derived rollups (sums of
member months). Prior periods remain **editable-and-audited** (an edit re-enters approval); **period
locking is deferred** to a later slice.

**Rationale**: monthly is the natural sales cadence; rollups avoid separate entry. Locking adds a
close/reopen workflow + permission that the user did not ask for now; editing is already fully
audited and re-approval-gated, which bounds the risk.

**Alternatives considered**: lock closed months now — rejected: YAGNI; adds workflow the user
deferred. Arbitrary custom periods — rejected: over-general; month + rollups covers the ask.

---

## D-GRAN — Approval granularity (resolves spec Open Decision)

**Decision**: the **unit of state is the row** (one `personal_kpis` row = consultant × period ×
metric); the approval queue UI **may** offer a batch action over a consultant's pending rows, which
calls the per-row guarded function N times.

**Rationale**: per-row state keeps the model simple and the status-log precise; batch is a pure UI
convenience over the same atomic primitive, so no new invariant.

**Alternatives considered**: approve a whole consultant-period as one unit — rejected: coarser log,
and a mixed batch (one bad metric) couldn't be partially approved.

---

## D-KEYS — Permission key split

**Decision**: four keys — `personalKpi.recordActual` (sale_consultant), `personalKpi.approveActual`
(centre_manager, centre_admin), `personalKpi.setTarget` (centre_manager, centre_admin),
`departmentKpi.setTarget` (super_admin via `system.admin` catch-all).

**Rationale**: §13 mandates *at least* two distinct keys (personal vs department). Splitting the
personal-table writers into record / approve / set-target makes each permission-rejection test precise
and prevents, e.g., an approver key from implying a record key. `super_admin`'s existing
`system.admin` catch-all satisfies `departmentKpi.setTarget` without a bespoke grant.

**Alternatives considered**: two keys only (personal, department) — rejected: can't distinguish
"record own" from "approve others" from "set target", which the approval model needs. A separate
`super_admin` grant list — rejected: the catch-all already covers it (matches existing pattern).

---

## Foundation facts confirmed (grounding, not decisions)

- `claims` = `{ authUserId, role, centreId, employeeId }` — **no `department_id`** (access-token hook
  injects only `app_role`/`centre_id`/`employee_id`); department grouping joins `employees` (D-AGG).
- RLS reads claims as `(select auth.jwt() ->> 'centre_id')` / `... ->> 'app_role'` (subquery-cached).
- `departments` is flat & network-wide (no `centre_id`); `employees` carries `centre_id` +
  `department_id`.
- `change_task_status` is the guarded-transition + status-log template (SECURITY INVOKER, `for
  update`, Vietnamese exceptions).
- `audit_log` (`actor_id, action, entity_type, entity_id, centre_id, metadata`) and the append-only
  status-log shape are reused directly.
- Canonical pipeline = `withError(() => { assertPermission(key); const input = schema.parse(raw);
  return service(client, input, claims) })`; errors → discriminated `{data}|{error}`, Vietnamese.
