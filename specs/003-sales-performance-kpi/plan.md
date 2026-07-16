# Implementation Plan: Sales Performance & KPI Tracker

**Branch**: `003-sales-performance-kpi` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-sales-performance-kpi/spec.md`

**Status**: Design artifact (review gate 2 of 3). Companion artifacts: [research.md](./research.md)
(decision log), [data-model.md](./data-model.md) (tables + RLS + trigger + functions),
[contracts/](./contracts/) (RLS, DB functions, server actions, attainment engine),
[quickstart.md](./quickstart.md) (validation scenarios).

## Summary

A `/hieu-suat` page in the existing jax-sales app where sales consultants record their own monthly
results (enrolments closed, revenue), managers approve them, and the management chain sees
target-vs-attainment dashboards, a ranking/leaderboard, and CSV+PDF exports — all scoped by role
tier. The load-bearing correctness of this slice is **the security model**, not an algorithm: two
distinct KPI tables (constitution §13), an **actual-only** owner-write trigger, an **approval
lifecycle** with a status-log on every transition (constitution §V), and a **tiered read** boundary
(own → centre → network) that is stricter than the foundation's broad-read default. Only **approved**
actuals count toward attainment, ranking, and rollups.

**Technical approach**: attainment/classification/rollup **maths** live in a pure, unit-tested
TypeScript module (`src/services/kpi/attainment.ts`) with no DB coupling. Everything that must not be
wrong about *access* is pushed into Postgres: `personal_kpis` (own-row, actual-only via a BEFORE
UPDATE trigger; RLS tiered read) and `department_kpi_targets` (network-wide, `super_admin`-only) as
two distinct tables with distinct permission keys; a SECURITY-INVOKER `approve_personal_kpi` /
`reject_personal_kpi` guarded function that transitions status and writes the `personal_kpi_status_logs`
row atomically (mirroring `change_task_status`); and RLS-INVOKER aggregation functions for
dashboard/leaderboard rollups so tiering is enforced at the database even for `GROUP BY` reads. Every
mutation flows through the canonical pipeline (`withError → assertPermission → schema.parse →
service`) and emits an `audit_log` entry. All copy is Vietnamese via the single `vocabulary.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16 App Router, React 19 (same app as slices #001/#002).

**Primary Dependencies**: `zod` (boundary validation), `@tanstack/react-query` (server-state),
`@supabase/ssr` + `@supabase/supabase-js`, `@react-pdf/renderer` (PDF summary — reused from slice
#002's decision), and the slice-#001 foundation modules (`vocabulary.ts`, `permissions.ts`,
`assert-permission.ts`, `claims.ts`, `server-action.ts`, `case.ts`, `pagination.ts`).

**Storage**: Supabase Postgres. Two new tables — `personal_kpis` (tiered read, own-row actual-only
write) and `department_kpi_targets` (network-wide, admin-only write) — plus one append-only
`personal_kpi_status_logs`. Reuses the existing `audit_log`, `departments`, `employees`, `centres`.

**Testing**: Vitest. Attainment/rollup maths unit-tested (pure, no DB). All security invariants
integration-tested against the **live local Supabase stack, sequentially, no mocking** (constitution
Principle IV): actual-only trigger, no-self-approve, cross-centre isolation of approval + targets,
tiered reads, department-target admin-only, approved-only aggregation, status-log completeness.

**Target Platform**: Web (server + client components); centre laptops, evergreen browsers.

**Project Type**: Web application (single Next.js app; new page + pure attainment module + DB layer).

**Performance Goals**: Record-own-result → see attainment < 1 min (SC-001). Dashboard/leaderboard
reads are set-based (`GROUP BY`) via SQL functions — no N+1, paginated (constitution). CWV budget
from #001.

**Constraints**: Only approved actuals count (SC-009). NULL target ⇒ "Chưa đặt mục tiêu", never 0%
(SC-002, constitution §13). Owner writes `actual` only, cannot approve (SC-003). Cross-centre
approval/target/read impossible (SC-004). Department targets `super_admin`-only (SC-005). Status-log
on every transition (SC-007, constitution §V). All copy Vietnamese. Files < 800 lines, functions
< 50, nesting ≤ 4. ≥ 80% coverage.

**Scale/Scope**: Mid-size chain (from #001): ~10 centres, low-hundreds staff, tens of thousands of
KPI rows/yr (SC-008). Indexed on every policy-referenced/hot column; paginated lists.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0 (incl. §13 KPI subsystem invariants).

| Principle | Gate | Status |
|---|---|---|
| **I. Vietnamese-First** | Metric names, period labels, approval + attainment states, errors all Vietnamese via the one `vocabulary.ts`; enum ids never rendered; a NULL target shows "Chưa đặt mục tiêu", never 0%. | ✅ PASS — FR-ACCESS-03, FR-TARGET-03, SC-002/011. |
| **II. Layered Security & Multi-Tenant Isolation (NON-NEGOTIABLE)** | Route guard + `assertPermission` (4 distinct keys) + RLS. Tiered read (own→centre→network) is **stricter** than broad-read — the §13-sanctioned `personal_kpis` own-row exception, justified in writing (Assumptions/Governance), not a violation. Writes centre-narrow; department targets network-only, admin-only. | ✅ PASS — FR-VIS-01, FR-ACCESS-01, SC-003/004/005/006. |
| **III. Canonical Mutation Pipeline** | record/approve/reject/setTarget flow `withError → assertPermission → schema.parse → service`; audit on every sensitive write; friendly Vietnamese errors. | ✅ PASS — FR-ACCESS-02, FR-ACTUAL-04, FR-APPROVAL, FR-TARGET-04. |
| **IV. Test-First with Isolation Proof (NON-NEGOTIABLE)** | TDD ≥80%; attainment maths unit-tested; actual-only, no-self-approve, cross-centre, tiered-read, admin-only, approved-only invariants each proven vs real DB, no mocks. | ✅ PASS — SC-003/004/005/006/009/010. |
| **V. Atomicity, Idempotency & Immutability** | approve/reject via a single guarded DB function (status transition + status-log atomic); status-log on EVERY transition incl. `fromStatus: null` at creation and the edit-reverts-to-pending transition; editing never retroactively mutates prior logs; immutable app code. | ✅ PASS — FR-APPROVAL-01/04, SC-007. |

**§13 KPI subsystem invariants** (explicit constitution clause for this exact module): two distinct
tables (`personal_kpis` own-row/actual-only + `department_kpi_targets` network-wide/admin-only) gated
by two distinct permission keys — honored, in fact split into four keys for precision (record /
approve / personal-target / department-target); NULL target renders "not set", never 0%. ✅ PASS.

**Engineering standards**: nav-is-access-matrix (one `/hieu-suat` entry, one list), camelCase↔snake_case
at the service boundary (`case.ts`), pagination on every list, single data seam, aggregations via SQL
`GROUP BY` functions (no N+1), size limits, explicit Vietnamese errors — all honored. ✅ PASS.

**Deliberate-limitations check** (constitution Development Workflow): §13's KPI shape is realized as
written (own-row `actual`-only + department targets top-admin-only, two keys, NULL≠0%). Manager
approval is an explicit user clarification (2026-07-16), layered on top without violating §13. ✅.

**Initial gate result: PASS.** No violations; Complexity Tracking not required. The tiered read is a
constitution-sanctioned §13 exception (own-row), documented — not a deviation needing justification
beyond the note recorded here and in the spec's Assumptions.

**Post-Design re-check (after Phase 1): PASS.** Each principle traces to an artifact — the two-table
schema + actual-only trigger + tiered RLS ([data-model.md](./data-model.md),
[contracts/rls-policies.md](./contracts/rls-policies.md)); the atomic approve/reject + aggregation
functions ([contracts/kpi-functions.md](./contracts/kpi-functions.md)); the canonical-pipeline server
actions ([contracts/kpi.actions.md](./contracts/kpi.actions.md)); the pure attainment contract
([contracts/attainment.md](./contracts/attainment.md)); the decision log ([research.md](./research.md)).
No new violations.

## Architecture & Module Boundaries

Separation so the security boundary (the part that must not be wrong) is at the database, and the
maths (the part that must be correct) is pure and exhaustively unit-tested:

```
DOMAIN DATA (pure, vocabulary-backed — no logic)
  src/lib/domain/kpi/
    metrics.ts            # metric catalog: {key, unit, aggregation}; default enrolments_closed, revenue
    periods.ts            # period model: YYYY-MM parse/format, quarter/year rollup membership
  src/lib/domain/vocabulary.ts   # + metric labels, approval-state labels (Chờ duyệt/Đã duyệt/Bị từ chối),
                                 #   attainment-state labels + badge colors

ATTAINMENT ENGINE (pure ⚙ — no DB/UI/network; unit-tested)
  src/services/kpi/attainment.ts # (approvedActual, target|null) -> {ratio, state}; classify; NULL≠0%
  src/services/kpi/rollup.ts     # sum approved actuals; period→quarter/year rollup; leaderboard sort+tiebreak

TYPES / SCHEMAS
  src/lib/data/types.ts          # + KPI enums (APPROVAL_STATES, ATTAINMENT_STATES, METRIC_KEYS) + entities
  src/schemas/kpi.ts             # Zod: RecordActualInput, SetPersonalTargetInput, SetDepartmentTargetInput,
                                 #      ApproveInput, RejectInput

PERSISTENCE / PIPELINE (DB is authoritative)
  supabase/migrations/*_kpi_schema.sql     # personal_kpis, department_kpi_targets, personal_kpi_status_logs + indexes
  supabase/migrations/*_kpi_rls.sql        # tiered-read + centre-narrow-write + admin-only policies
  supabase/migrations/*_kpi_functions.sql  # actual-only trigger; approve/reject guarded fn; dashboard/leaderboard agg fns
  src/services/kpi/kpi.service.ts          # recordActualCore, setPersonalTargetCore, setDepartmentTargetCore,
                                           #   dashboardCore, leaderboardCore, listPendingCore (queries + RPC calls)
  src/app/actions/kpi/                      # recordActual, approveActual, rejectActual, setPersonalTarget,
                                           #   setDepartmentTarget, getDashboard, getLeaderboard, exportReport

EXPORT
  src/lib/kpi/export/
    csv.ts                # tier-confined rows -> CSV string (Vietnamese headers)
    KpiReportDocument.tsx # @react-pdf summary (embedded Vietnamese-covering font, reused from #002 fonts.ts)

UI (page)
  src/app/(app)/hieu-suat/
    page.tsx              # server: resolve claims, gate, branch surface by role tier
    RecordActualForm.tsx  # client: consultant records own actuals (US1)
    MyPerformance.tsx     # client: consultant's own attainment (no leaderboard) (US3 consultant tier)
    ApprovalQueue.tsx     # client: manager approves/rejects centre pending actuals (US7)
    TargetEditor.tsx      # client: manager sets per-consultant targets; admin sets department targets (US2)
    Dashboard.tsx         # client: centre/network attainment dashboard (US3 manager/admin tier)
    Leaderboard.tsx       # client: ranked view, manager/admin only (US4)
    ExportButton.tsx      # client: trigger CSV + PDF export (US5)
```

**Data flow**: consultant `RecordActualForm` → `recordActual` action (canonical pipeline; UPDATE
`personal_kpis.actual`; the actual-only trigger forces `approval_status = pending` and writes a
status-log; audit) → row is `pending`, excluded from rollups. Manager `ApprovalQueue` → `approveActual`
/`rejectActual` action → `approve_personal_kpi(...)` guarded function (atomic transition + status-log)
→ row counts (approved) or returns to consultant (rejected). Dashboards/leaderboards call RLS-INVOKER
aggregation functions so the caller's tier auto-scopes the summed rows.

## Security Model (the load-bearing design)

Three enforcement layers, none collapsible (constitution II), plus the §13 shape:

1. **UI guard** — `page.tsx` gates on nav-matrix membership; renders the surface for the caller's
   role tier only. Convenience, never proof.
2. **App permission gate** — four distinct keys via `assertPermission`:
   `personalKpi.recordActual` (sale_consultant) · `personalKpi.approveActual` (centre_manager,
   centre_admin) · `personalKpi.setTarget` (centre_manager, centre_admin) · `departmentKpi.setTarget`
   (super_admin only, via the `system.admin` catch-all). Registered in `permissions.ts`.
3. **RLS (authoritative)**:
   - `personal_kpis` **tiered SELECT** (the new pattern): `super_admin` → all; `centre_manager`/
     `centre_admin` → `centre_id = own`; `sale_consultant` → `consultant_id = own employee_id`;
     `teacher` → none. UPDATE/INSERT centre-narrow (owner's own row for the consultant path).
   - `personal_kpis` **BEFORE UPDATE trigger** (`enforce_actual_only`): when the actor is the owning
     consultant, only `actual` may change (any change to `target`/`approval_status`/ids raises); an
     `actual` change forces `approval_status → pending` and the trigger writes the status-log. Target
     changes (manager path) and approval transitions (guarded function) are the only other writers.
   - `department_kpi_targets` **admin-only write** (Pattern B), read by managers+admins.
   - `personal_kpi_status_logs` append-only (Pattern A insert; no update/delete), tier-readable.
4. **Atomic transitions** — `approve_personal_kpi`/`reject_personal_kpi` are SECURITY-INVOKER plpgsql
   functions (RLS still applies, so cross-centre approval is impossible) that lock the row, verify
   it is `pending` and in the approver's centre, update status, and insert the status-log in one
   statement — mirroring `change_task_status`.

## Error Handling

- **Input**: Zod at the boundary (`schemas/kpi.ts`); friendly Vietnamese messages. Negative/non-int
  actual, target ≤ 0, unknown metric/period → blocked (FR-ACTUAL-03; zero-target rejected per
  research D-ZERO).
- **Approval**: guarded function raises Vietnamese exceptions (row not found, not pending, wrong
  centre); surfaced via `withError` → `{error}`.
- **Writes**: `withError` → discriminated `{data}|{error}`; audit-log write is part of the same
  service call; full detail logged server-side, friendly Vietnamese to the user.
- **NULL target**: rendered as "Chưa đặt mục tiêu" everywhere; never computed as 0% (structural — the
  attainment engine returns `not_set`, no ratio).

## Testing Strategy

Ordered so the pure maths and the security proofs land before UI:

1. **Attainment/rollup unit tests (pure)** — `actual/target` ratio; classification (not_set /
   on_track / behind / no_result); NULL target ⇒ not_set, never 0% (SC-002); approved-only inclusion;
   period→quarter/year rollup sums; leaderboard descending + deterministic tie-break (AC-4.4).
2. **Security integration tests (live DB, no mocks)** — the proofs (constitution IV):
   - actual-only trigger: a consultant UPDATE that touches `target`/`approval_status`/peer row fails;
     an `actual`-only UPDATE succeeds and flips status to `pending` + writes a log (SC-003, AC-1.2).
   - no self-approve: a `sale_consultant` cannot call approve (no key) (SC-003, AC-7.4).
   - cross-centre: a centre-A manager cannot approve or set targets for a centre-B row; raw
     RLS-bypass INSERT/UPDATE probes fail (SC-004, AC-6.3).
   - tiered read: consultant sees only own; manager sees own centre; super_admin sees all; teacher
     none (SC-006, AC-3.1/3.2/3.3).
   - department target: `super_admin` succeeds, all others denied (SC-005, AC-2.4).
   - approved-only: a `pending`/`rejected` actual appears in 0% of aggregates/leaderboard (SC-009).
   - status-log + audit: every transition (create→pending, approve, reject, edit→pending) writes a
     status-log; every sensitive write writes an audit row (SC-007).
3. **Coverage** ≥ 80% for the attainment engine + all tenancy/permission/approval boundaries (SC-010).

## Project Structure

### Documentation (this feature)

```text
specs/003-sales-performance-kpi/
├── plan.md            # this file
├── research.md        # decision log (remaining open decisions resolved with reasoning)
├── data-model.md      # tables, types, RLS, actual-only trigger, guarded + aggregation functions
├── contracts/
│   ├── rls-policies.md      # personal_kpis (tiered) / department_kpi_targets / status_logs RLS
│   ├── kpi-functions.md     # actual-only trigger; approve/reject; dashboard/leaderboard aggregation
│   ├── kpi.actions.md       # record/approve/reject/setTarget/get*/export server-action contracts
│   └── attainment.md        # pure attainment + rollup engine contract
├── quickstart.md      # validation scenarios
├── checklists/requirements.md
└── tasks.md           # NEXT (/speckit-tasks — not created here)
```

### Source Code — see Architecture & Module Boundaries above (single Next.js app at repo root).

**Structure Decision**: reuse the slice-#001 app structure and its foundation seams verbatim. The
attainment maths (`src/services/kpi/`) and metric/period data (`src/lib/domain/kpi/`) are new pure
modules; the page lives under the existing `(app)` shell; persistence adds three migrations (schema,
RLS, functions) following the established Pattern-A RLS, the `change_task_status` guarded-function
template, and the `task_status_logs`/`audit_log` seams. New KPI enums/entities extend
`src/lib/data/types.ts`; four permission keys and one nav entry are registered in the existing
registries. No new top-level project.

> **Migration numbering**: existing migrations run through `20260716120006`; slice #002 adds its own
> `roadmap_records` migration concurrently. This slice's migrations are assigned timestamps that sort
> **after** whatever exists at implementation time (e.g. the `2026071612010x` block) — confirm the
> highest existing number before `/speckit-implement` to avoid a collision with the concurrent #002
> work.

## Complexity Tracking

No constitution violations — intentionally empty. The tiered-read pattern is a §13-sanctioned
own-row exception (documented in the Constitution Check and the spec's Assumptions), not added
complexity requiring justification.
