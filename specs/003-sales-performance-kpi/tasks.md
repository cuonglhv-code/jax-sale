---
description: "Task list for Sales Performance & KPI Tracker (jax-sales slice #003)"
---

# Tasks: Sales Performance & KPI Tracker

**Input**: Design documents from `specs/003-sales-performance-kpi/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: TDD is **MANDATORY** (constitution Principle IV). The load-bearing correctness of this
slice is the **security model** (not an algorithm), so the DB substrate is built first and its
invariants are proven against the **live local Supabase stack, sequentially, no mocking**. The pure
attainment maths are unit-tested. Every security test is written **test-first (must fail)**.

**Organization**: by user story. **Ordering rule**: Setup → Foundational (DB substrate + pure engine)
→ the P1 read/write verticals (US1 record → US7 approve → US2 targets → US3 dashboard) → the
NON-NEGOTIABLE security-proof gate (US6) → P2 add-ons (US4 leaderboard, US5 export) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete tasks.
- **[Story]**: US1–US7 (user-story tasks only; Setup/Foundational/Polish carry no story label).
- Paths follow [plan.md](./plan.md) Architecture. Builds on the slice-#001 foundation.

⚠️ **Migration numbering** (plan): existing migrations run through `...120006`; slice #002 adds its own
concurrently. Confirm the highest existing number and assign this slice's three migrations **after**
it (T013) to avoid a collision.

---

## Phase 1: Setup (register foundation seams)

- [X] T001 [P] Confirm `@react-pdf/renderer` present (added by slice #002) or add it to `package.json`; the PDF export (US5) reuses #002's embedded Vietnamese-covering font registration (`src/lib/ielts/pdf/fonts.ts`)
- [X] T002 [P] Register the four permission keys in `src/lib/auth/permissions.ts` — `personalKpi.recordActual` (sale_consultant), `personalKpi.approveActual` (centre_manager, centre_admin), `personalKpi.setTarget` (centre_manager, centre_admin), `departmentKpi.setTarget` (super_admin via `system.admin`) (FR-ACCESS-01, D-KEYS)
- [X] T003 [P] Update the existing reserved `/hieu-suat` nav entry (key `performance`) in `NAV_ITEMS` — add `centre_admin` + `sale_consultant` to its roles (consultants must reach the page to record) so it becomes super_admin/centre_manager/centre_admin/sale_consultant, still hidden from teacher, in `src/lib/domain/vocabulary.ts` (FR-ACCESS-01, D-TEACHER). NOTE: entry pre-existed as a reserved slot (roles were super_admin+centre_manager only); updated rather than added
- [X] T004 [P] Add Vietnamese labels to `src/lib/domain/vocabulary.ts`: metric labels (Số học viên chốt, Doanh thu), approval states (Chờ duyệt/Đã duyệt/Bị từ chối), attainment states + badge colors (not_set/on_track/behind/no_result) (FR-ACCESS-03, SC-002/011)

---

## Phase 2: Foundational (DB substrate + pure engine — blocks all stories)

**⚠️ CRITICAL**: the security substrate and the attainment maths below block every user story.

### Types, schemas, pure engine (test-first for the engine)

- [X] T005 [P] Add KPI enums (`METRIC_KEYS`, `APPROVAL_STATES`, `ATTAINMENT_STATES`) + entity interfaces (`PersonalKpiEntry`, `DepartmentKpiTarget`, `PersonalKpiStatusLog`, `Attainment`, `KpiDashboardRow`) to `src/lib/data/types.ts` per [data-model.md](./data-model.md)
- [X] T006 [P] Metric catalog (`metrics.ts`) + period helpers (`periods.ts`: YYYY-MM parse/format, quarter/year membership) in `src/lib/domain/kpi/` (data-model, D-PERIOD)
- [X] T007 [P] Zod schemas (`recordActualInput`, `setPersonalTargetInput`, `setDepartmentTargetInput`, `approveInput`, `rejectInput`; period regex, `target > 0`, `actual ≥ 0`) in `src/schemas/kpi.ts` per [contracts/kpi.actions.md](./contracts/kpi.actions.md) (D-ZERO)
- [X] T008 [P] Attainment/rollup unit tests (write FIRST, MUST fail): classify (not_set/on_track/behind/no_result; **NULL target ⇒ not_set, never 0%**; approved-only inclusion); `rollupPeriods` sums; `rankLeaderboard` descending + name tie-break in `tests/unit/kpi/attainment.test.ts` + `tests/unit/kpi/rollup.test.ts` (SC-002/009, AC-4.4)
- [X] T009 Implement pure `attainment.ts` (`classifyAttainment`) + `rollup.ts` (`rollupAttainment`, `rollupPeriods`, `rankLeaderboard`) in `src/services/kpi/` per [contracts/attainment.md](./contracts/attainment.md) — green

### Persistence (the security substrate)

- [X] T010 Migration `*_kpi_schema.sql`: `personal_kpis` (unique (consultant,period,metric); CHECK `target>0` or NULL, `actual≥0`, period regex, approval_status enum), `department_kpi_targets` (no centre_id; `target>0`), `personal_kpi_status_logs` (append-only) + indexes per [data-model.md](./data-model.md)
- [X] T011 Migration `*_kpi_rls.sql`: **tiered** SELECT + centre-narrow write on `personal_kpis`; Pattern-B admin-only on `department_kpi_targets`; append-only tiered `personal_kpi_status_logs` per [contracts/rls-policies.md](./contracts/rls-policies.md) (FR-VIS-01)
- [X] T012 Migration `*_kpi_functions.sql`: `enforce_actual_only` BEFORE UPDATE trigger + `log_actual_edit_transition`; `approve_personal_kpi`/`reject_personal_kpi` guarded functions; `kpi_dashboard`/`kpi_leaderboard` SECURITY-INVOKER aggregation functions per [contracts/kpi-functions.md](./contracts/kpi-functions.md) (FR-APPROVAL, D-ACTUAL/D-AGG)
- [X] T013 Confirm highest existing migration number (avoid #002 collision), stamp these three after it; apply (`supabase db reset`); verify tables + policies + trigger + 4 functions exist
- [X] T014 [P] Extend `supabase/seed.sql`: ≥2 centres across ≥2 departments, each with a sale_consultant + centre_manager/centre_admin, plus a super_admin (RFC-4122 UUIDs — memory gotcha) for isolation + department-rollup tests. NOTE: existing slice-#001 seed already satisfied this (2 centres, 4 depts, super_admin + centre_manager(Q1) + centre_admin(Q3) + 2 sale_consultants across centres + teacher) — verified live in DB, no seed changes needed

**Checkpoint**: security substrate + attainment engine ready; every story can now be built test-first.

---

## Phase 3: User Story 1 — Consultant records own actuals (Priority: P1) 🎯 MVP-start

**Goal**: a consultant records their own period results; each is `pending` and excluded from rollups.

**Independent Test**: as `sale_consultant`, record values → rows persist `pending` with a `null→pending`
log; the owner sees them; a UPDATE touching target/status/peer row fails.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [X] T015 [P] [US1] Actual-only trigger proof: a consultant UPDATE touching `target`/`approval_status`/a peer row fails; an `actual`-only UPDATE succeeds → `pending` + status-log in `tests/integration/kpi/actual-only.test.ts` (AC-1.2/1.4, SC-003)
- [X] T016 [P] [US1] Record proof: a role lacking `personalKpi.recordActual` is denied; recording seeds `pending` + a `null→pending` log; re-record edits to `pending` in `tests/integration/kpi/record-actual.test.ts` (AC-1.1)

### Implementation
- [X] T017 [US1] `recordActualCore` in `src/services/kpi/kpi.service.ts` — upsert own row's `actual` (INSERT seeds `pending` + writes `null→pending` log; `consultant_id`/`centre_id` from claims, never client) + audit (FR-ACTUAL-01..04)
- [X] T018 [US1] `recordActual` server action (canonical pipeline + audit) in `src/app/actions/kpi/record-actual.ts` per [contracts/kpi.actions.md](./contracts/kpi.actions.md)
- [X] T019 [US1] `getMyPerformance` read action (own entries + derived `Attainment` for a period; own approval states) in `src/app/actions/kpi/get-my-performance.ts`
- [X] T020 [US1] `/hieu-suat` `page.tsx` server (resolve claims, gate, branch surface by tier) + `RecordActualForm.tsx` + `MyPerformance.tsx` (consultant tier: own attainment, no leaderboard) in `src/app/(app)/hieu-suat/` (AC-1.1/1.5, AC-3.1)

**Checkpoint**: a consultant records results → sees own provisional attainment; nothing counts yet.

---

## Phase 4: User Story 7 — Manager approves / rejects actuals (Priority: P1)

**Goal**: a manager approves (→ counts) or rejects (→ returns to consultant) centre pending actuals.

**Independent Test**: approve a pending row → it enters aggregates; reject one → returns as `rejected`,
still excluded; a centre-A manager cannot approve a centre-B row.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [X] T021 [P] [US7] Transition proof: approve `pending→approved` + status-log; reject `→rejected` + log; approve/reject only from `pending`; editing an approved actual reverts to `pending` in `tests/integration/kpi/approval.test.ts` (AC-7.1/7.2/7.5, SC-007)
- [X] T022 [P] [US7] Approval isolation: a `sale_consultant` cannot approve (no key, no self-approve); a centre-A manager cannot approve a centre-B row (RLS-invisible) in `tests/integration/kpi/approval-isolation.test.ts` (AC-7.3/7.4, SC-003/004)

### Implementation
- [X] T023 [US7] `approveActual` + `rejectActual` server actions (RPC to guarded functions + audit) in `src/app/actions/kpi/approve-actual.ts`, `reject-actual.ts` per [contracts/kpi.actions.md](./contracts/kpi.actions.md)
- [X] T024 [US7] `listPendingApprovals` read action (own-centre `pending`, paginated) in `src/app/actions/kpi/list-pending.ts`
- [X] T025 [US7] `ApprovalQueue.tsx` (client) — approve/reject each row; optional batch over a consultant's pending rows (D-GRAN) in `src/app/(app)/hieu-suat/` (AC-7.1/7.2)

**Checkpoint**: only approved actuals count toward attainment/ranking/rollups.

---

## Phase 5: User Story 2 — Managers & admins set targets (Priority: P1)

**Goal**: centre managers/admins set per-consultant targets; super_admin sets department targets.

**Independent Test**: a manager sets a consultant's target → attainment shows; a non-admin is denied a
department target; a cross-centre target is rejected; a NULL target shows "Chưa đặt mục tiêu".

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [ ] T026 [P] [US2] Personal-target proof: set within own centre works; cross-centre rejected; a manager cannot write `actual` (trigger); NULL clears → not_set; zero target rejected in `tests/integration/kpi/personal-target.test.ts` (AC-2.1/2.2/2.5, D-ZERO)
- [ ] T027 [P] [US2] Department-target proof: `super_admin` succeeds; every other role denied; not centre-confined in `tests/integration/kpi/department-target.test.ts` (AC-2.3/2.4, SC-005)

### Implementation
- [ ] T028 [US2] `setPersonalTargetCore` + `setDepartmentTargetCore` in `src/services/kpi/kpi.service.ts` (upsert/clear `target`; audit) (FR-TARGET-01..04)
- [ ] T029 [US2] `setPersonalTarget` + `setDepartmentTarget` server actions (canonical pipeline) in `src/app/actions/kpi/` per [contracts/kpi.actions.md](./contracts/kpi.actions.md)
- [ ] T030 [US2] `TargetEditor.tsx` (client) — manager sets per-consultant targets; admin sets department targets; NULL/clear support in `src/app/(app)/hieu-suat/` (AC-2.1/2.3/2.5)

**Checkpoint**: targets drive attainment; NULL renders "not set", never 0%.

---

## Phase 6: User Story 3 — Dashboard with tiered visibility (Priority: P1)

**Goal**: each role sees an attainment dashboard scoped to its tier (own → centre → network).

**Independent Test**: seed two centres; each role sees exactly its tier's rows + aggregates and nothing
beyond; only approved actuals appear.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [ ] T031 [P] [US3] Tiered-read proof (two-centre seed): consultant sees own only; centre mgr/admin see own centre; super_admin all; teacher none in `tests/integration/kpi/tiered-read.test.ts` (AC-3.1/3.2/3.3/3.4, SC-006)
- [ ] T032 [P] [US3] Approved-only aggregation: `pending`/`rejected` excluded from dashboard aggregates; quarter/year rollup sums correct in `tests/integration/kpi/aggregation.test.ts` (AC-3.7, SC-009)

### Implementation
- [ ] T033 [US3] `getDashboard` read action (`rpc('kpi_dashboard')`; assemble `KpiDashboardRow[]` with `Attainment` via the engine); return `Paginated<KpiDashboardRow>` (bounded by staff-per-period; page/limit via `pagination.ts`) in `src/app/actions/kpi/get-dashboard.ts` (FR-CALC-03)
- [ ] T034 [US3] `Dashboard.tsx` (client) — attainment by consultant/centre/department at tier; period + quarter/year selector; vocabulary-backed states (never 0% for not_set) in `src/app/(app)/hieu-suat/` (AC-3.5/3.6, SC-002)

**Checkpoint**: every tier sees exactly its scope; pending/rejected excluded.

---

## Phase 7: User Story 6 — Permission gate & isolation proof (Priority: P1) 🔒 NON-NEGOTIABLE

**Goal**: the whole security model holds — 4 keys gated, every sensitive write audited, no cross-tier
leak — proven against the real DB. Ties together the per-story proofs above.

**Independent Test**: the consolidated suites are green against the live local DB across a two-centre
seed.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [ ] T035 [P] [US6] Permission matrix: each of the four keys grants exactly its roles; an unauthorized caller of each is rejected (record/approve/personal-target/department-target) in `tests/integration/kpi/permission-matrix.test.ts` (AC-6.1, SC-003/005)
- [ ] T036 [P] [US6] Audit + status-log completeness: every sensitive write (record/edit/approve/reject/setTarget/clear) emits an `audit_log` row with changed fields; every status transition writes a status-log in `tests/integration/kpi/audit-completeness.test.ts` (AC-6.4, SC-007)
- [ ] T037 [P] [US6] Two-centre isolation E2E: a full A/B flow proves no cross-tier read/write/approve leak on any table in `tests/integration/kpi/isolation-e2e.test.ts` (AC-6.2/6.3, SC-004/006)

**Checkpoint**: the NON-NEGOTIABLE security model is proven green — the P1 gate is closed.

---

## Phase 8: User Story 4 — Ranking / leaderboard (Priority: P2)

**Goal**: managers/admins see a tier-scoped ranked leaderboard; consultants get no leaderboard.

**Independent Test**: a manager sees their centre ranked; super_admin sees centres network-wide; a
`sale_consultant` has no leaderboard surface.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [ ] T038 [P] [US4] Leaderboard proof: tier-scoped ranking (mgr=own centre, super_admin=network), deterministic tie-break by name, approved-only, consultant denied in `tests/integration/kpi/leaderboard.test.ts` (AC-4.1/4.2/4.3/4.4)

### Implementation
- [ ] T039 [US4] `getLeaderboard` read action (`rpc('kpi_leaderboard')`; deny `sale_consultant`; return `Paginated<RankedEntry>` / top-N via `pagination.ts`) in `src/app/actions/kpi/get-leaderboard.ts` (AC-4.3, FR-CALC-03)
- [ ] T040 [US4] `Leaderboard.tsx` (client) — ranked list, approved-only, per tier in `src/app/(app)/hieu-suat/` (AC-4.1/4.2)

**Checkpoint**: managers/admins get rankings; consultants do not.

---

## Phase 9: User Story 5 — Exportable period report (Priority: P2)

**Goal**: managers/admins export the period view as CSV + a branded PDF, confined to the caller's tier.

**Independent Test**: a manager exports → CSV + PDF containing only their centre's rows for the period,
Vietnamese labels + correct diacritics.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [ ] T041 [P] [US5] Export proof: tier-confined (no row beyond the caller's tier); Vietnamese headers; approved-only figures in `tests/integration/kpi/export.test.ts` (AC-5.1/5.2/5.3)

### Implementation
- [ ] T042 [P] [US5] CSV builder (Vietnamese headers, tier rows, period/scope stamp) in `src/lib/kpi/export/csv.ts` (AC-5.1/5.3/5.4)
- [ ] T043 [P] [US5] `KpiReportDocument.tsx` (@react-pdf one-page summary; reuse #002 `fonts.ts` for diacritics) in `src/lib/kpi/export/` (AC-5.3)
- [ ] T044 [US5] `exportReport` action (assemble CSV + PDF from the caller's tier rows; stamp period/scope/timestamp) + `ExportButton.tsx` in `src/app/actions/kpi/export-report.ts` and `src/app/(app)/hieu-suat/` (AC-5.1/5.4)

**Checkpoint**: CSV + PDF export, strictly within the caller's tier.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T045 [P] Vietnamese-only audit: no raw enum id / English system string / misleading 0% on any KPI screen or export (SC-011)
- [ ] T046 [P] Coverage ≥ 80% for the attainment engine + all tenancy/permission/approval boundaries; actual-only, NULL-target, approved-only, cross-tier invariants each covered (SC-010)
- [ ] T047 [P] Enforce size limits (files < 800, functions < 50, nesting ≤ 4) + immutable patterns across the new KPI modules (constitution Engineering Standards)
- [ ] T048 Run [quickstart.md](./quickstart.md) happy-path + validation-table scenarios; record results (SC-001..009)
- [ ] T049 Final migration-numbering check: the three KPI migrations sort after the highest existing (incl. #002's) before merge (plan coordination note)
- [ ] T050 [P] Seed a representative volume (~tens of thousands of `personal_kpis` rows across ~10 centres over multiple periods) and assert dashboard + leaderboard reads stay **paginated and N+1-free** within a reasonable budget in `tests/integration/kpi/volume.test.ts` (SC-008)

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → **Foundational (P2)**: permission keys/nav/labels + the DB substrate + pure engine block everything.
- **P1 verticals**: **US1 (record)** → **US7 (approve)** → **US2 (targets)** → **US3 (dashboard)**. US7 needs US1's pending rows; US3's aggregation is only meaningful once approve (US7) + targets (US2) exist.
- **US6 (security gate, P1)**: after the P1 read/write mechanisms (US1/US7/US2/US3) exist — it proves the whole matrix. The NON-NEGOTIABLE close of the P1 scope.
- **P2 add-ons**: **US4 (leaderboard)** and **US5 (export)** build on the proven primitives; independent of each other.
- **Polish (P10)**: after all desired stories.

### Within each story
- Security/functional tests written and **failing** before implementation (TDD). Service → action → UI.
- Reads use `assertAuthenticated` + tiered RLS; mutations use the canonical pipeline + audit.

### Parallel opportunities
- **Setup**: T001–T004 [P]. **Foundational**: T005–T008 [P] (types/catalog/schemas/engine-tests); T014 [P].
- **Per-story test-first pairs** are [P] (different files, must fail first): T015/T016 · T021/T022 · T026/T027 · T031/T032 · T035/T036/T037 · export T042/T043.

---

## Parallel Example: US6 security-proof gate (write first, must fail)

```bash
Task: "Permission matrix test in tests/integration/kpi/permission-matrix.test.ts"      # T035
Task: "Audit + status-log completeness in tests/integration/kpi/audit-completeness.test.ts" # T036
Task: "Two-centre isolation E2E in tests/integration/kpi/isolation-e2e.test.ts"         # T037
```

## Parallel Example: Foundational types + engine (Phase 2)

```bash
Task: "KPI enums + entities in src/lib/data/types.ts"          # T005
Task: "Metric catalog + period helpers in src/lib/domain/kpi/" # T006
Task: "Zod schemas in src/schemas/kpi.ts"                      # T007
Task: "Attainment/rollup unit tests (must fail) in tests/unit/kpi/"  # T008
```

---

## Implementation Strategy

### MVP scope
Setup + Foundational + **US1 + US7 + US2 + US3 + US6** (all P1) = consultants record results, managers
approve + set targets, each tier sees its attainment dashboard, and the security model is proven. US4
(leaderboard) and US5 (export) are P2 enhancements on top.

### Incremental delivery
1. Setup + Foundational → security substrate + attainment engine ready.
2. + US1 (record) → consultants log results (pending).
3. + US7 (approve) → approved results start counting.
4. + US2 (targets) → attainment becomes meaningful.
5. + US3 (dashboard) → each tier sees its attainment.
6. + US6 (security gate) → the whole model proven green. **← shippable, proven MVP.**
7. + US4 (leaderboard) → ranked management view.
8. + US5 (export) → CSV + PDF sharing.
9. Polish → Vietnamese audit, coverage, size/immutability, quickstart, migration numbering.

### Notes
- [P] = different files, no dependency on incomplete tasks.
- Tests MUST fail before implementation (verify red → green); security proofs run vs the live local DB, no mocks (constitution IV).
- The security substrate (RLS tiered read + actual-only trigger + guarded approve/reject + RLS-invoker aggregation) is built in Foundational and proven in US6 — it is the part that must not be wrong.
- Only **approved** actuals ever enter aggregates, ranking, or export.
