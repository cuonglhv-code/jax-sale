# Feature Specification: Sales Performance & KPI Tracker

**Feature Branch**: `003-sales-performance-kpi`

**Created**: 2026-07-16

**Status**: Draft — requirements artifact (review gate 1 of 3: spec → plan → tasks)

**Input**: User-defined via interview (2026-07-16). Slice **#003 of jax-sales** — a sales-performance
tracker: each sales consultant records their own period results (enrolments closed, revenue); a
manager approves those results; managers and top-admins set targets; everyone sees dashboards, a
ranking/leaderboard, and an exportable report — all scoped by role tier. Because the leads/deals
pipeline is **not built yet**, results are **manually entered per period** (no dependency on an
unbuilt module). Built as a page in the existing Next.js + Supabase app on the slice-#001 foundation
(auth, the five roles, `department` first-class entity, centre tenancy, audit seam, vocabulary /
nav-access-matrix seams) and governed by the constitution's **§13 KPI subsystem invariants**.

---

## Overview

The **Sales Performance & KPI Tracker** turns each consultant's monthly results into a
target-vs-actual performance picture that the whole management chain can see at the right altitude.
A consultant opens the page and enters their own figures for the current period — enrolments closed
and revenue — and nothing else; they can never touch a target or another person's numbers. Each
recorded figure enters an **approval queue**; a centre manager or centre admin reviews and approves
(or rejects) it, and **only approved figures count** toward ranking and rollups. A centre manager
sets each of their consultants' targets and watches their centre's attainment and ranking. A
top-admin sets network-wide department targets and sees every centre. The result is one place that
answers "who is on track, who is behind, and by how much" — reportable on screen, as a ranked
leaderboard, and as a downloadable period report.

**Why this slice:** a sales-performance tracker is one of the user's explicitly named future modules,
and the slice-#001 foundation was deliberately hardened for it (department as a first-class,
network-wide entity; the audit-log seam; the permission registry). It is also the module the
**constitution already specifies most concretely** (§13): two distinct KPI tables, an actual-only
write trigger, distinct permission keys, and the NULL-target "not set" rule. This slice realises that
subsystem. It further establishes the **tiered-visibility read pattern** (own → centre → network)
for sensitive data — a deliberate, documented tightening of the foundation's broad-read default that
later compensation/HR modules will reuse.

**Foundation integration (from slice #001):**
- Distinct permission keys registered in the single permission registry (FR-024a of #001), honouring
  constitution §13's "two distinct tables / two distinct permission keys" invariant (personal actuals
  and department targets never share a key):
  - `personalKpi.recordActual` — a consultant records/edits their OWN actual (actual column, own row
    only); role: `sale_consultant`.
  - `personalKpi.approveActual` — a manager approves/rejects a consultant's recorded actual within
    their own centre; roles: `centre_manager`, `centre_admin`.
  - `personalKpi.setTarget` — set/clear a per-consultant target within the setter's own centre; roles:
    `centre_manager`, `centre_admin`.
  - `departmentKpi.setTarget` — set/clear a network-wide department target; role: `super_admin` only.
- One new entry in the single nav/access matrix (`NAV_ITEMS`), route `/hieu-suat`, label
  "Hiệu suất & KPI". Visible to `super_admin`, `centre_manager`, `centre_admin`, `sale_consultant`;
  hidden from `teacher` by default (see Open Decisions — teacher scope).
- Reuses the first-class `department` entity (FR-024f of #001) as the grouping dimension for
  department targets and rollups.
- Every actual record/edit, approval, rejection, and target change emits the foundation's general
  audit-log entry (FR-024g of #001):
  `{ actorId, action: "<entity>.<verb>", entityType, entityId, changed fields }`.
- All labels (metric names, period names, roles, departments, attainment states, approval states)
  resolve through the single vocabulary source; every mutating action flows through the canonical
  pipeline (`withError → assertPermission → schema.parse → service`).

---

## Clarifications

### Session 2026-07-16

- Q: How are a consultant's self-entered actuals trusted — counted as-is, or manager-approved first?
  → A: Manager approval required — a recorded actual is `pending` and does not count toward ranking or
  rollups until a centre manager/admin approves it; a full approval lifecycle with status-log applies.
- Q: Who can set per-consultant targets (within their own centre)? → A: Both `centre_manager` and
  `centre_admin`, confined to their own centre (`super_admin` still owns network department targets).
- Q: What export format(s) should the period report support? → A: Both — a CSV data export and a
  simple branded PDF summary (PDF requires embedded fonts for Vietnamese diacritics).
- Q: What does a sales consultant see about ranking/leaderboard? → A: Own attainment only — no peer
  rank and no leaderboard; the leaderboard is a manager/admin-only surface.

---

## Domain data (authoritative — encode as data, not logic)

### Metric catalog (the KPIs tracked this slice)

Metrics are a defined, vocabulary-backed list so new metrics can be added without code changes to the
engine. Default catalog for this slice:

| Metric key | Vietnamese label | Unit | Aggregation |
|---|---|---|---|
| `enrolments_closed` | Số học viên chốt | count (integer ≥ 0) | sum |
| `revenue` | Doanh thu | VND (integer ≥ 0) | sum |

Additional metrics MAY be added later purely as data. Attainment is computed identically for any
metric (`actual / target`).

### Period model

- A **period** is a calendar **month**, identified `YYYY-MM` (e.g. `2026-07`).
- Quarter and year figures are **derived rollups** (sums of the constituent monthly periods), not
  separately entered.
- The "current period" is the month containing today; prior periods remain visible and, by default,
  editable (every edit is audited and re-enters approval — see Assumptions on period locking).

### Approval status (lifecycle of a recorded actual; vocabulary-backed)

A recorded actual is a lifecycle entity (constitution §V): every transition writes a status-log row,
and creation writes a `fromStatus: null` log.

| State | Vietnamese label | Meaning | Counts toward ranking/rollups? |
|---|---|---|---|
| `pending` | Chờ duyệt | recorded/edited by the consultant, awaiting manager review | **No** |
| `approved` | Đã duyệt | approved by a centre manager/admin | **Yes** |
| `rejected` | Bị từ chối | declined by a manager; consultant must edit & resubmit | **No** |

Transitions: record → `pending` (from null); manager approve → `approved`; manager reject →
`rejected`; consultant edit of a `pending`/`rejected`/**`approved`** actual → back to `pending`
(editing an approved value un-approves it and requires re-approval).

### Attainment states (vocabulary-backed; drive dashboard/leaderboard color and label)

Attainment is computed from **approved** actuals only (pending/rejected values are shown to the owner
but excluded from attainment-based ranking and rollups).

| State | Condition |
|---|---|
| `not_set` | target IS NULL — rendered as an explicit "Chưa đặt mục tiêu", **never 0%** (constitution §13) |
| `on_track` | target set AND approved actual ≥ target (≥ 100%) |
| `behind` | target set AND 0 < approved actual < target |
| `no_result` | target set AND no approved actual for the period (0 or unrecorded) |

---

## User Scenarios & Testing *(mandatory)*

Acceptance criteria use EARS form: `WHEN <trigger> THE SYSTEM SHALL <response>` (event-driven),
`IF <condition> THEN THE SYSTEM SHALL <response>` (unwanted/edge), `WHILE <state>` (state-driven),
`THE SYSTEM SHALL <response>` (ubiquitous).

### User Story 1 — Consultant records their own period results (Priority: P1)

A sales consultant opens the KPI page, selects the current period, and enters their actual figures
for each metric (enrolments closed, revenue). They save; the figure is submitted for approval and the
page shows their actual, its approval state, and their target with an attainment percentage (marked as
provisional until approved).

**Why P1**: Actuals are the raw material of the whole feature; nothing downstream (approval,
attainment, dashboards, ranking, reports) exists without a recorded actual, and self-entry is the
chosen data-source for this slice.

**Independent Test**: As a `sale_consultant`, enter values for the current period and save → the row
persists in the `pending` state with a creation status-log, and the owner sees their value marked
"Chờ duyệt".

**Acceptance criteria (EARS)**:
- AC-1.1 — WHEN a consultant submits actual values for their own row in a period THE SYSTEM SHALL
  persist them in the `pending` state, write a creation status-log (`fromStatus: null → pending`), and
  display actual, approval state, target (or "not set"), and provisional attainment.
- AC-1.2 — THE SYSTEM SHALL restrict a consultant to writing ONLY the `actual` value on their OWN
  row; a consultant MUST NOT be able to set or change any `target`, approve any row, nor write any
  other person's row — enforced at the database, not only the UI (constitution §13 actual-only trigger
  + RLS).
- AC-1.3 — IF an actual value is negative or non-numeric THEN THE SYSTEM SHALL reject the entry and
  show a Vietnamese validation message naming the metric.
- AC-1.4 — WHEN a consultant edits a previously-saved actual (in any state, including `approved`) THE
  SYSTEM SHALL set it back to `pending`, write a status-log for the transition, and emit an audit-log
  entry recording the actor, the period/metric, and that the value changed.
- AC-1.5 — WHILE no target is set for a metric THE SYSTEM SHALL show the attainment as
  "Chưa đặt mục tiêu" (not_set) and MUST NOT render 0% (constitution §13).

### User Story 2 — Managers and top-admins set targets (Priority: P1)

A centre manager or centre admin sets each of their consultants' per-period targets for each metric
within their own centre. A `super_admin` additionally sets network-wide **department** targets.
Attainment is then measured against these.

**Why P1**: Without targets there is no "performance" — only raw totals. Targets are the other half of
the attainment the user explicitly asked for; and the constitution mandates the two-table split.

**Independent Test**: As a centre manager set a consultant's target for the current period → that
consultant's dashboard now shows an attainment %; as a `super_admin` set a department target → the
department rollup shows attainment.

**Acceptance criteria (EARS)**:
- AC-2.1 — WHEN a centre manager or centre admin sets a per-consultant target for a period/metric
  within their own centre THE SYSTEM SHALL persist it, and attainment for that consultant SHALL be
  computed as `approved actual / target`.
- AC-2.2 — THE SYSTEM SHALL confine per-consultant target-setting to the setter's own centre; a
  manager MUST NOT set targets for a consultant of another centre — enforced at the database.
- AC-2.3 — WHEN a `super_admin` sets a network-wide **department** target for a period/metric THE
  SYSTEM SHALL persist it in the department-target store (distinct table from personal actuals), gated
  by a permission key distinct from actual-recording (constitution §13 two-table / two-key invariant);
  department targets are NOT centre-confined.
- AC-2.4 — THE SYSTEM SHALL restrict department-target management to `super_admin` only; every other
  role attempting it MUST be denied.
- AC-2.5 — WHEN a target is cleared/unset THE SYSTEM SHALL revert the affected attainment to the
  "Chưa đặt mục tiêu" (not_set) state, never 0%.

### User Story 3 — Performance dashboard with tiered visibility (Priority: P1)

Each role opens a dashboard sized to its altitude: a consultant sees only their own actual-vs-target
across metrics and periods; a centre manager/admin sees every consultant in their centre plus the
centre total; a `super_admin` sees all centres and all departments.

**Why P1**: The dashboard is the primary surface and the point of the tool; tiered visibility is the
user's chosen exposure model and a first-class security boundary for sensitive results.

**Independent Test**: Seed actuals/targets across two centres; sign in as each role and assert each
sees exactly its tier's rows and totals and nothing beyond.

**Acceptance criteria (EARS)**:
- AC-3.1 — WHEN a `sale_consultant` opens the dashboard THE SYSTEM SHALL show only their own rows
  (including their own pending/rejected values, marked as such); they MUST NOT see any peer's figures
  (this slice tightens the foundation's broad-read default for performance data — see Assumptions).
- AC-3.2 — WHEN a centre manager or centre admin opens the dashboard THE SYSTEM SHALL show every
  consultant in their OWN centre and the centre aggregate, and MUST NOT show another centre's rows.
- AC-3.3 — WHEN a `super_admin` opens the dashboard THE SYSTEM SHALL show all centres and all
  department rollups.
- AC-3.4 — THE SYSTEM SHALL enforce these read tiers at the database, so a manipulated request cannot
  read outside the caller's tier (constitution II layered isolation).
- AC-3.5 — THE SYSTEM SHALL render every attainment via the vocabulary-backed state (not_set /
  on_track / behind / no_result) with its label and color, never a raw number-only or English string.
- AC-3.6 — THE SYSTEM SHALL support selecting a period (month) and a derived rollup (quarter / year)
  and recompute the displayed figures accordingly.
- AC-3.7 — THE SYSTEM SHALL compute every centre/department/network aggregate and every
  attainment-based figure from **approved** actuals only; pending/rejected values MUST be excluded
  from aggregates and ranking.

### User Story 4 — Ranking / leaderboard scoped to the viewer (Priority: P2)

A manager or admin sees consultants (or centres) ranked by a chosen metric and period, so they can
see at a glance who is ahead and who is behind. Consultants do not get a leaderboard.

**Why P2**: A ranked view is the "tracker" framing the user asked for and adds real management value,
but the dashboard (US3) already delivers the core value; the leaderboard is a focused enhancement.

**Independent Test**: With seeded data, a centre manager opens the leaderboard → their centre's
consultants appear ranked by the selected metric (approved actuals only); a `super_admin` sees centres
ranked network-wide; a `sale_consultant` has no leaderboard surface.

**Acceptance criteria (EARS)**:
- AC-4.1 — WHEN a centre manager/admin opens the leaderboard THE SYSTEM SHALL rank the consultants of
  their OWN centre by the selected metric and period (approved actuals only), descending.
- AC-4.2 — WHEN a `super_admin` opens the leaderboard THE SYSTEM SHALL offer a network-wide ranking of
  centres (and, on drill-in, consultants) by the selected metric and period.
- AC-4.3 — THE SYSTEM SHALL NOT expose any leaderboard or peer ranking to a `sale_consultant`; a
  consultant sees only their own attainment (no rank, anonymised or otherwise).
- AC-4.4 — WHERE two entries tie on the ranked metric THE SYSTEM SHALL break the tie deterministically
  (e.g. by name) so ordering is stable and testable.

### User Story 5 — Exportable period report (Priority: P2)

A manager or admin downloads the current view (dashboard or leaderboard) for a chosen period as a
shareable report for offline management review — as CSV data and/or a branded PDF summary.

**Why P2**: Export supports management workflows and the user requested it, but it is a
value-add on top of the on-screen surfaces rather than the core loop.

**Independent Test**: As a centre manager, export the centre's period report → a CSV and a PDF
download, each containing exactly that centre's rows for the selected period and nothing beyond the
caller's tier.

**Acceptance criteria (EARS)**:
- AC-5.1 — WHEN a permitted user exports a period report THE SYSTEM SHALL produce a downloadable CSV
  (data) and a simple branded PDF (summary), each containing the same rows and figures the caller is
  entitled to see on screen (approved actuals for aggregates/ranking).
- AC-5.2 — THE SYSTEM SHALL confine the export strictly to the caller's visibility tier; an export
  MUST NOT include any row the caller could not see on the dashboard.
- AC-5.3 — THE SYSTEM SHALL render all labels, metric names, approval states, and attainment states in
  both exports in Vietnamese via the vocabulary source; the PDF MUST render full Vietnamese diacritics
  with embedded fonts.
- AC-5.4 — THE SYSTEM SHALL stamp each report with the period, the scope (consultant / centre /
  network), and the generation timestamp.

### User Story 6 — Permission gate & isolation proof (Priority: P1) 🔒 NON-NEGOTIABLE

Every write is gated by the correct permission key; the two KPI data domains stay distinct; and no
caller can read or write outside their centre/tier — proven against the real database.

**Why P1**: The constitution makes layered security and isolation NON-NEGOTIABLE, and mandates that
the model be proven by tests against a real DB. Performance/compensation data raises the stakes.

**Independent Test**: Run the permission-rejection and tier-isolation suites against a live local DB;
all unauthorized writes and cross-tier reads are rejected.

**Acceptance criteria (EARS)**:
- AC-6.1 — THE SYSTEM SHALL gate actual-recording, actual-approval, per-consultant target-setting, and
  department-target management behind distinct permission keys; an unauthorized caller of any MUST be
  rejected (proven by a rejection test).
- AC-6.2 — THE SYSTEM SHALL enforce, at the database, that a consultant can update only `actual` on
  only their own row and can never approve a row (proven by a test that an owner's attempt to write
  `target`, approve, or touch a peer's row fails).
- AC-6.3 — THE SYSTEM SHALL enforce centre isolation for per-consultant targets, actual-approval, and
  centre reads, and network-only scope for department targets (proven by a centre-A-cannot-touch-
  centre-B test, including a manager of centre A cannot approve a centre-B actual).
- AC-6.4 — WHEN a sensitive write occurs (actual record/edit, approve, reject, target set/clear) THE
  SYSTEM SHALL emit the foundation's general audit-log entry, recording which fields changed (not
  their values, for updates).

### User Story 7 — Manager approves (or rejects) recorded actuals (Priority: P1)

A centre manager or centre admin opens an approval queue of their centre's pending actuals, reviews
each, and approves or rejects it. Approving makes the figure count toward attainment, ranking, and
rollups; rejecting returns it to the consultant to correct and resubmit.

**Why P1**: The user chose manager approval as the trust model — so an actual is not "real" until
approved. Ranking, rollups, and department attainment are only meaningful once this gate is in place.

**Independent Test**: As a consultant, record an actual (→ pending, excluded from ranking); as that
centre's manager, approve it → it now appears in the centre aggregate and leaderboard; reject a second
one → it returns to the consultant as `rejected` and stays excluded.

**Acceptance criteria (EARS)**:
- AC-7.1 — WHEN a `centre_manager` or `centre_admin` approves a pending actual in their OWN centre THE
  SYSTEM SHALL transition it to `approved`, write a status-log row (`pending → approved`, with actor),
  and include it in aggregates, attainment, and ranking thereafter.
- AC-7.2 — WHEN a manager rejects a pending actual THE SYSTEM SHALL transition it to `rejected`, write
  a status-log row, keep it excluded from aggregates/ranking, and surface it to the owning consultant
  for correction.
- AC-7.3 — THE SYSTEM SHALL confine approval/rejection to actuals within the approver's own centre; a
  manager MUST NOT approve or reject a consultant's actual in another centre — enforced at the
  database.
- AC-7.4 — THE SYSTEM SHALL prevent self-approval by a `sale_consultant` (a consultant lacks the
  approval permission entirely) and MUST reject any such attempt.
- AC-7.5 — WHEN a consultant edits an already-`approved` actual THE SYSTEM SHALL revert it to
  `pending` (AC-1.4), removing it from aggregates/ranking until it is approved again.

### Edge Cases

- **No target set** — WHILE a metric has no target THE SYSTEM SHALL show "Chưa đặt mục tiêu", exclude
  it from attainment-based ranking (or rank it last, deterministically), and MUST NOT display 0%.
- **Actual recorded but zero (and approved)** — IF a target exists and the approved actual is 0 THEN
  THE SYSTEM SHALL show the `no_result` state (0% is meaningful here — distinct from `not_set`).
- **Pending / rejected actual** — WHILE an actual is `pending` or `rejected` THE SYSTEM SHALL exclude
  it from all aggregates, attainment classification, and ranking; the owning consultant still sees it
  marked with its approval state.
- **Edit after approval** — WHEN a consultant edits an approved actual THE SYSTEM SHALL revert it to
  `pending` so a value cannot be approved and then silently changed. (AC-7.5)
- **Target of zero** — IF a target is set to 0 THEN THE SYSTEM SHALL reject it (a 0 target makes
  attainment undefined) with a Vietnamese message, OR treat it as "not set" — see Open Decisions.
- **Editing a closed/prior period** — WHEN a prior period's actual is edited THE SYSTEM SHALL allow it
  by default, re-enter it into `pending`, and audit it; period locking is deferred (see Assumptions).
- **Consultant with no rows yet** — WHEN a consultant has recorded nothing for a period THE SYSTEM
  SHALL show empty/`no_result` states, never an error or a blank crash.
- **Department with no members / no centre members** — WHEN a department or centre has no consultants
  in a period THE SYSTEM SHALL show a zero/empty aggregate with a clear "no data" state.
- **Role change mid-period** — WHEN a user's role/centre/department changes THE SYSTEM SHALL apply the
  new tier to what they can see/write/approve on their next request, consistent with the foundation's
  session staleness bound (≤30 min; immediate on deactivation/demotion).
- **Cross-centre override** — Only `super_admin` may view via a centre switcher; every other role is
  pinned to its own centre regardless of any URL param (constitution II).

---

## Requirements *(mandatory)*

### Functional Requirements

**Recording actuals (personal KPIs)**
- **FR-ACTUAL-01**: A consultant MUST be able to record and edit their OWN actual value for each
  metric in a period; recording/editing MUST place the row in the `pending` state; the system MUST
  persist one actual per (consultant, period, metric).
- **FR-ACTUAL-02**: The system MUST enforce, at the database (RLS + a BEFORE UPDATE trigger per
  constitution §13), that an owner can write ONLY the `actual` column on ONLY their own row — never a
  target, never an approval state, never another person's row.
- **FR-ACTUAL-03**: Actual values MUST be validated at the server boundary (non-negative integers;
  units per the metric catalog) before persistence, with Vietnamese messages.
- **FR-ACTUAL-04**: Every actual create/edit MUST emit the foundation's general audit-log entry and,
  as a lifecycle transition, MUST write a status-log row (constitution §V).

**Approval lifecycle**
- **FR-APPROVAL-01**: A recorded actual MUST carry an approval state (`pending` / `approved` /
  `rejected`); creation MUST write a `fromStatus: null → pending` status-log, and every subsequent
  transition MUST write a status-log row recording actor and from/to state (constitution §V).
- **FR-APPROVAL-02**: A `centre_manager` or `centre_admin` MUST be able to approve or reject a pending
  actual within their OWN centre, via a permission key distinct from actual-recording; the action MUST
  be denied for any other role and for any actual outside the approver's centre — enforced at the
  database.
- **FR-APPROVAL-03**: Only `approved` actuals MUST count toward attainment, aggregates, rollups,
  ranking, and export figures; `pending`/`rejected` actuals MUST be excluded from all of these while
  remaining visible to the owning consultant with their state.
- **FR-APPROVAL-04**: Editing an actual in ANY state (including `approved`) MUST return it to
  `pending` (re-approval required), so an approved value cannot be silently altered.

**Targets**
- **FR-TARGET-01**: A `centre_manager` or `centre_admin` MUST be able to set/clear a per-consultant
  target for a metric/period within their OWN centre; this MUST be a distinct write path (distinct
  permission) from actual-recording and from approval.
- **FR-TARGET-02**: A `super_admin` MUST be able to set/clear network-wide **department** targets in a
  store (table) distinct from personal actuals, gated by a permission key distinct from actual-
  recording (constitution §13 two-table / two-key invariant); department targets are NOT centre-
  confined.
- **FR-TARGET-03**: A NULL/absent target MUST render as an explicit "not set" state and MUST NEVER be
  shown or computed as 0% (constitution §13).
- **FR-TARGET-04**: Every target set/clear MUST emit the foundation's general audit-log entry.

**Attainment & aggregation**
- **FR-CALC-01**: Attainment MUST be computed as `approved actual / target` for any metric with a
  non-null target, and classified into the vocabulary-backed states (not_set / on_track / behind /
  no_result).
- **FR-CALC-02**: Centre, department, and network aggregates MUST be computed by summing the
  constituent **approved** actuals/targets; quarter and year figures MUST be derived rollups of
  monthly periods.
- **FR-CALC-03**: Aggregations MUST be performed with set-based queries (no N+1) and every list MUST
  be paginated (constitution Engineering Standards).

**Visibility & reporting**
- **FR-VIS-01**: Reads MUST be tiered — `sale_consultant` sees only own; centre manager/admin see own
  centre; `super_admin` sees all — and this tiering MUST be enforced at the database, not only the
  UI. (This deliberately tightens the foundation's broad-read default for sensitive performance data;
  justification recorded in Assumptions/Governance.)
- **FR-VIS-02**: The dashboard MUST present actual-vs-target by consultant, centre, and department at
  the caller's tier, with period and rollup selection, and MUST distinguish approved from
  pending/rejected values in the owner's own view.
- **FR-VIS-03**: The leaderboard MUST rank entities (consultants within a centre; centres
  network-wide) by a selected metric/period (approved actuals only), scoped to the caller's tier, with
  deterministic tie-breaking; it MUST NOT be exposed to `sale_consultant`.
- **FR-VIS-04**: A permitted user MUST be able to export the current period view as a downloadable CSV
  (data) and a simple branded PDF (summary), each confined to the caller's tier, with Vietnamese
  labels and correct diacritics (embedded fonts in the PDF).

**Access & foundation integration**
- **FR-ACCESS-01**: The page MUST appear as one entry in the single nav/access matrix and MUST be
  gated via the permission registry; UI guard, app permission gate, and RLS MUST all be present and
  MUST NOT be collapsed (constitution II).
- **FR-ACCESS-02**: All mutations (record actual, approve/reject, set/clear target) MUST flow through
  the canonical pipeline (`withError → assertPermission → schema.parse → service`).
- **FR-ACCESS-03**: All user-facing copy (metrics, periods, approval states, attainment states, roles,
  departments, errors) MUST be Vietnamese, resolved through the single vocabulary source.

### Key Entities *(include if feature involves data)*

- **Metric** (catalog data): `key`, Vietnamese `label`, `unit` (count / VND), aggregation rule. An
  extensible, vocabulary-backed list; default = `enrolments_closed`, `revenue`.
- **PersonalKpiEntry** (`personal_kpis`; per constitution §13 — own-row, actual-only write for the
  owner; a lifecycle entity per §V): `consultantId`, `centreId`, `period` (YYYY-MM), `metricKey`,
  `target` (nullable — set by the manager/admin target path, not the owner), `actual` (owner-writable),
  `approvalStatus` (`pending` / `approved` / `rejected`). One row per (consultant, period, metric).
- **PersonalKpiStatusLog** (per constitution §V — one row per transition; table
  `personal_kpi_status_logs`): `entryId`, `fromStatus` (nullable at creation), `toStatus`,
  `changedById`, `changedAt`. Complete history of every approval transition and every edit-driven
  revert-to-pending.
- **DepartmentKpiTarget** (`kpi_metrics`; per constitution §13 — network-wide, top-admin only):
  `departmentId`, `period`, `metricKey`, `target`. Distinct table, distinct permission key; NOT
  centre-confined.
- **Attainment / KpiDashboardRow** (derived, not stored; the `Attainment` shape at a scope, grouped
  into a `KpiDashboardRow`): approved actual, target-or-null, ratio, state (not_set / on_track /
  behind / no_result), at consultant / centre / department / network scope.
- **AuditLogEntry** (foundation seam, reused): `{ actorId, action ("personalKpi.recordActual" /
  "personalKpi.editActual" / "personalKpi.approveActual" / "personalKpi.rejectActual" /
  "personalKpi.setTarget" / "personalKpi.clearTarget" / "departmentKpi.setTarget"), entityType,
  entityId, changedFields }`.

---

## Success Criteria *(mandatory)*

### Measurable outcomes
- **SC-001**: A consultant can record their own period results and see their submitted value and
  approval state in **under 1 minute**, measured end-to-end.
- **SC-002**: A NULL target renders as an explicit "not set" state in **100%** of cases and is shown
  or computed as 0% in **0%** of cases — verified by test (constitution §13).
- **SC-003**: A `sale_consultant` can read or write another person's figures in **0%** of attempts,
  can alter a target in **0%** of attempts, and can approve any actual (including their own) in **0%**
  of attempts — verified against the real database (owner actual-only, own-row, no self-approval).
- **SC-004**: Cross-centre reads/writes/approvals of per-consultant targets, actuals, and centre data
  succeed in **0%** of attempts (centre-A-cannot-touch-centre-B) — verified against the real database.
- **SC-005**: Department-target management succeeds for `super_admin` and fails for **100%** of other
  roles — verified against the real permission gate.
- **SC-006**: Each role's dashboard, leaderboard, and export contain **exactly** the rows of its tier
  and **zero** rows beyond it, and consultants have **no** leaderboard surface — verified across a
  two-centre seed.
- **SC-007**: **100%** of sensitive writes (actual record/edit, approve, reject, target set/clear)
  produce an audit-log entry with the changed fields, and every approval transition writes a
  status-log row — verified by test.
- **SC-008**: Attainment, ranking, and rollups are correct for a seeded dataset at the mid-size-chain
  baseline (~10 centres, low-hundreds staff, tens of thousands of KPI rows/yr) with paginated,
  N+1-free queries — verified by test and a representative-volume check.
- **SC-009**: **Only approved actuals** appear in aggregates, ranking, and export figures; a
  `pending` or `rejected` actual appears in **0%** of aggregates/ranking — verified by test.

### Quality bar
- **SC-010**: Automated coverage of the attainment/aggregation/approval logic and the
  permission/tier/isolation boundaries is **≥ 80%**; the actual-only, NULL-target, approved-only, and
  cross-tier invariants are each covered by an explicit test.
- **SC-011**: No consultant-, manager-, or admin-facing screen or export displays a raw enum id,
  English system string, or a misleading 0% for an unset target; all copy is Vietnamese via the
  vocabulary source.

---

## Open Decisions (RESOLVED at plan — see research.md)

**Status (2026-07-16): all resolved.** The four decisions above were resolved in the Clarifications
session; the five below were resolved at `/speckit-plan` with the recommended defaults — see
[research.md](./research.md) decisions D-TEACHER, D-ZERO, D-PERIOD, D-GRAN, and D-EXPORT/D-PDF. The
list is retained for traceability; the spec body already encodes each default.

Surfaced here (not silently chosen). Requirements above are written against the **recommended
default** so the spec is internally consistent; the alternative is noted. (Four earlier decisions —
self-report integrity, per-consultant target ownership, consultant leaderboard visibility, and export
format — were resolved in the 2026-07-16 Clarifications session above.)

1. **Teacher scope**. `teacher` is one of the five roles but is not a sales role. Decide whether the
   page is hidden for `teacher` entirely, or shown read-only for their own (likely empty) KPI.
   Recommended default: **hidden from the nav for `teacher`** (no sales KPI applies) — written into
   the spec above.
2. **Target-of-zero handling**. Reject a 0 target vs treat it as "not set". Recommended default:
   **reject with a Vietnamese message** (a 0 target makes attainment undefined).
3. **Period locking**. Prior periods are editable-and-audited (re-entering approval) by default;
   whether/when to lock a closed month (and who may reopen) is deferred to a later slice unless the
   user wants it now.
4. **Approval granularity** (plan-level). Approve per row (per consultant/period/metric) vs
   batch-approve a consultant's whole period at once. Recommended default: **the unit of state is the
   row; the UI MAY offer a batch-approve action** over a consultant's pending rows.
5. **PDF rendering approach** (plan-level). Library choice that guarantees Vietnamese diacritics +
   embedded fonts (same concern resolved in slice #002) belongs in plan.md.

---

## Assumptions

- **Built into jax-sales** (not standalone): a page in the existing Next.js 16 + Supabase app, on the
  slice-#001 foundation, realising the constitution's §13 KPI subsystem (two tables, actual-only
  trigger, distinct permission keys, NULL-target "not set") and §V lifecycle invariants
  (status-log-on-every-transition) for the approval flow.
- **Manual-entry data source with manager approval**: results are self-entered per period and count
  only once a centre manager/admin approves them; there is no dependency on the unbuilt leads/deals
  pipeline. `PersonalKpiEntry` is structured so a future deals/enrolment module can populate/reconcile
  actuals without reshaping the tables.
- **Tiered reads are a deliberate tightening** of the foundation's broad-read default, justified
  because sales-performance/compensation data is sensitive; this is consistent with §13's
  `personal_kpis` being own-row and is recorded here per the Governance "deviation justified in
  writing" rule.
- **Period = calendar month**; quarter/year are derived rollups. Currency is **VND**; counts are
  non-negative integers. These are vocabulary/catalog data, changeable without engine edits.
- **Metric catalog default** = `enrolments_closed`, `revenue`; the list is data-driven and extensible.
- **Attainment is a derived view**, never stored; the only persisted numbers are actuals and targets,
  plus each actual's approval state and status-log.
- **Recommended defaults** for the remaining Open Decisions above are used so the spec is testable
  now; they are confirmed at plan time.

## Dependencies

- **Slice #001 foundation**: auth + the five roles, the first-class network-wide `department` entity
  (FR-024f), centre tenancy + RLS pattern, the audit-log seam (FR-024g), the status-log-on-every-
  transition pattern (constitution §V, proven by the Tasks vertical), the permission registry
  (FR-024a), the nav/access matrix (FR-024b), and the single vocabulary source (FR-024).
- **Constitution §13 (KPI subsystem invariants)** as the authoritative "how": `personal_kpis`
  (own-row, actual-only, RLS + BEFORE UPDATE trigger) and `kpi_metrics` (department targets, top-admin
  only) as two distinct tables gated by distinct permission keys; NULL target ⇒ "not set", never 0%.
- **Constitution §V (Atomicity, Idempotency & Immutability)** as the authoritative "how" for the
  approval lifecycle: every status transition writes a status-log row; creation logs `fromStatus: null`.
- **REBUILD-SPEC.md §13** as background reference for the KPI subsystem's product intent (the
  interview drives scope; the doc is not auto-converted into this spec).
