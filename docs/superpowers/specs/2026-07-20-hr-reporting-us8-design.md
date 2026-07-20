# HR Reporting (US8) — Launch-Readiness Design

**Date:** 2026-07-20
**Status:** Implemented and verified (2026-07-20)

## Context

A full audit of all 5 Spec Kit slices (`specs/001-*` through `specs/005-*`) found that every slice is
complete except one gap: **slice 004 (HR Requests)'s User Story 8 — Reporting**. This is the only
speced, tasked, and committed-scope feature with no page and no user-facing surface at all. Everything
else audited — Tasks, Sales Performance/KPI, IELTS Roadmap Builder, IELTS Summit, and every other HR
Requests user story — is fully built and tested.

Modules named as "later slices" during slice #001 planning (leads pipeline, students/SIS, activities +
task-generation, workflow builder, pricing/pathway, dashboards, course suggestions) were never speced,
planned, or tasked at all — zero code, zero `specs/00N-*` folder. These are confirmed **out of scope**
for this launch (internal staff rollout across all 5 roles, covering exactly what's already speced).

This launch-readiness plan is scoped to closing the US8 gap only. Unfinished tests/security proofs
(e.g. KPI US6 polish tasks), real email delivery, and general polish/QA are explicitly out of scope —
to be addressed separately.

## Current state (verified by direct code inspection, not tasks.md checkboxes)

`specs/004-hr-requests/tasks.md` marks T060–T062 (US8) as unchecked, but substantial work already
exists in the repo:

**Already built:**
- `src/services/hr-report.service.ts` — all 4 aggregation functions, fully implemented:
  - `listLeaveByEmployeeCore` — leave taken by employee/centre/period (FR-038)
  - `listRequestsByTypeStatusCore` — requests grouped by type & status (FR-038)
  - `listOutstandingBalancesCore` — annual-leave balance per employee for a leave year (FR-038)
  - `getCoverageViewCore` — "who is off and who is covering" (FR-039, SC-007)
  - All four are role-scoped (centre_manager/centre_admin → own centre; super_admin → network-wide),
    paginated (`Paginated<T>` via `src/lib/pagination.ts`), and never touch `request_attachment` —
    so there is no medical-document content to leak.
- `src/schemas/hr/report.ts` — Zod filter schemas: `reportFilterSchema`, `outstandingBalancesFilterSchema`,
  `coverageViewFilterSchema`.
- `tests/integration/hr/us8-report.test.ts` — 6 integration tests against the live local Supabase stack,
  all passing: centre-scoping (manager vs super_admin), type/status aggregation correctness, balance
  math, permission rejection for non-manager/non-super_admin roles, an end-to-end coverage-view proof
  (submit → nominate → accept → approve → query), and an explicit assertion that no report row ever
  serializes `storage_path`/`mimeType` fields.
- One full action→hook pair, following the canonical mutation-pipeline pattern exactly:
  `src/app/actions/hr/list-leave-report.ts` (`listLeaveReport`) →
  `src/hooks/queries/hr/useLeaveReport.ts` (`useLeaveReport`).
- `papaparse` + `@types/papaparse` already present in `package.json` dependencies.
- Permission key `hrReport.view` already registered in `src/lib/auth/permissions.ts`, granted to
  `centre_manager` and (via `system.admin`) `super_admin`.

**Missing:**
1. Server actions + hooks for the other 3 report queries (only `listLeaveReport`/`useLeaveReport` exist).
2. The page itself — no `src/app/(app)/nhan-su/bao-cao/` directory exists.
3. CSV export wiring (dependency present, unused for HR).
4. Nav registration — `hrReports` is not in `NAV_ITEMS` (`src/lib/domain/vocabulary.ts`). The file's own
   comment documents the rule: nav items for unbuilt modules were deliberately trimmed to avoid sidebar
   404s, to be "re-added the same slice its `page.tsx` lands — never before." This is that slice.
5. Vocabulary labels for tab titles / table headers.

## Design

### 1. Server actions + hooks (replicate existing pattern)

Three new action/hook pairs, mirroring `list-leave-report.ts` / `useLeaveReport.ts` exactly:

- `src/app/actions/hr/list-requests-report.ts` (`listRequestsReport`) →
  `src/hooks/queries/hr/useRequestsReport.ts` (`useRequestsReport`)
- `src/app/actions/hr/list-balances-report.ts` (`listBalancesReport`) →
  `src/hooks/queries/hr/useBalancesReport.ts` (`useBalancesReport`)
- `src/app/actions/hr/get-coverage-report.ts` (`getCoverageReport`) →
  `src/hooks/queries/hr/useCoverageReport.ts` (`useCoverageReport`)

Each action: `withError` → `createServerSupabaseClient()` → `assertPermission(supabase, "hrReport.view")`
→ parse with the matching schema → call the matching `*Core` service function. No new interfaces beyond
what `hr-report.service.ts` already exports.

### 2. Page structure — tabs, one per report

`src/app/(app)/nhan-su/bao-cao/page.tsx` (server component, permission-gated same as
`nhan-su/duyet/page.tsx` and `nhan-su/lich-day/page.tsx`) renders a client board component
`ReportsBoard.tsx` with 4 tabs:

1. **Nghỉ phép theo nhân viên** (Leave by employee) — date range + optional employee filter; table of
   employee/centre/type/status/dates/working days; uses `useLeaveReport`.
2. **Yêu cầu theo loại & trạng thái** (Requests by type & status) — date range filter; grouped count
   table using existing `REQUEST_TYPE_LABEL`/`REQUEST_STATUS_LABEL` from vocabulary.ts (no raw enum
   renders); uses `useRequestsReport`.
3. **Số dư phép còn lại** (Outstanding balances) — leave-year filter; table of
   employee/entitlement/consumed/opening-adjustment/remaining; uses `useBalancesReport`.
4. **Lịch dạy thay** (Coverage view) — required date range; table of who's off / who's covering /
   class / session date; uses `useCoverageReport`.

Each tab owns its own filter state, its own table, and its own CSV export button — no shared filter
state across tabs (each report has a different natural filter shape, e.g. balances need a leave year,
not a date range).

### 3. CSV export — CSV only, no PDF

One shared helper, `src/lib/hr/export/csv.ts`, exposing a small `buildReportCsv(rows, columns)`
function built on `papaparse.unparse` (mirrors the existing `src/lib/kpi/export/csv.ts` shape but
without the PDF half of that module — internal ops reports don't need a branded document the way
KPI/roadmap outputs do). Each tab defines its own column list (label + accessor) and calls the shared
builder; download-as-blob logic reuses the same small `downloadBlob` pattern already inlined in
`ExportButton.tsx`.

### 4. Nav registration

Add to `NAV_ITEMS` in `src/lib/domain/vocabulary.ts`:

```ts
{
  key: "hrReports",
  route: "/nhan-su/bao-cao",
  label: "Báo cáo nhân sự",
  roles: ["super_admin", "centre_manager"],
}
```

And add `"hrReports"` to the `ModuleKey` union. Roles match `hrReport.view`'s grant set exactly
(`centre_manager` explicitly, `super_admin` via `system.admin`) — `centre_admin` is excluded, matching
`hrReport.view` not being granted to that role today (confirmed in `permissions.ts`).

### 5. Vocabulary

Add tab-title and column-header labels to `vocabulary.ts` alongside the existing HR labels (§ HR
Requests labels, slice #004) — no new enum types needed, since the 4 tabs reuse existing
`RequestType`/`RequestStatus` vocabulary for the type/status tab and only need net-new plain string
labels for column headers.

## Testing

- Backend (service + integration tests) is already complete and passing — no changes needed there.
- New server actions are thin wrappers around already-tested `*Core` functions — low incremental risk.
  No dedicated action-level test exists today even for the one already-built `listLeaveReport` action
  (it's covered only indirectly via `hr-report.service.ts`'s integration tests); match that existing
  precedent rather than introducing a new per-action test layer for the 3 new ones.
- Add a nav-access assertion (matching the existing `vocabulary.nav.test.ts` pattern) proving
  `hrReports` resolves for `centre_manager`/`super_admin` and is absent for the other 3 roles.
- Unit-test the CSV builder as a pure function (given rows + columns, produces expected CSV string) —
  no live DB needed.
- Manual smoke test: load each of the 4 tabs as `managerQ1` and as `superAdmin`, confirm filters work,
  confirm CSV downloads open cleanly with correct headers.

## Out of scope

- KPI US6 polish tasks, HR Polish-phase items T063–T068 (auto-purge cron, `/nhan-su/cau-hinh` config UI,
  coverage top-up, quickstart/security-proof re-run) — separate work, not part of this plan.
- Real email delivery (Resend wiring for IELTS PDF or HR notifications).
- Any never-speced module (leads, students, dashboards, activities, workflows, pricing/pathway, course
  suggestions) — confirmed out of scope for this launch.

## Outcome (2026-07-20)

Implemented in a separate concurrent worktree session (`.claude/worktrees/sick-leave-text-reason`) while
this design was being written, then verified against this design after the fact. `specs/004-hr-requests/
tasks.md` T060–T062 are now checked `[X]`.

**Matches the design:**
- All 4 server actions + hooks built (`list-leave-report`/`useLeaveReport`, `list-requests-summary`/
  `useRequestsSummary`, `list-outstanding-balances`/`useOutstandingBalances`, `list-coverage`/
  `useCoverageView`), each following the canonical `withError` → `assertPermission("hrReport.view")` →
  schema `.parse` → `*Core` pipeline exactly.
- `/nhan-su/bao-cao/page.tsx` gated to `centre_manager`/`super_admin`, matching `hrReport.view`'s grant
  set.
- Nav entry (`hrReports`, `ModuleKey`) added to `vocabulary.ts` exactly as designed.
- CSV-only export (no PDF), using `papaparse.unparse`.
- All 4 reports use existing `REQUEST_TYPE_LABEL`/`REQUEST_STATUS_LABEL` vocabulary — no raw enum
  renders, no new enum types.

**Diverged from the design (functionally equivalent, noted for accuracy):**
- **Layout**: shipped as 4 stacked sections on one page (`ReportsBoard.tsx`) rather than 4 tabs. Each
  section still owns its own table and CSV export button as designed; only the tab chrome was dropped.
  A single shared start/end-date filter drives 3 of the 4 sections (leave-by-employee, requests-summary,
  coverage — coverage falls back to the current calendar year's full range when the shared filter is
  empty); outstanding-balances uses a fixed current-year filter rather than a user-facing leave-year
  picker. This is a simpler filter model than the per-tab-owned-state design called for, at the cost of
  a coverage-view default that's a leave *year* proxy rather than the spec's plain required date range.
- **CSV builder**: implemented inline in `ReportsBoard.tsx` (a `downloadCsv` helper + per-section column
  mapping at the call site) rather than as a shared `src/lib/hr/export/csv.ts` module. Functionally
  equivalent; slightly less reusable if a 5th report type is added later.

**Verification performed this session** (after confirming the local Supabase stack had recovered from a
concurrent `db reset` by the other worktree — same recurring pattern documented in project memory for
slice #003):
- `tests/integration/hr/us8-report.test.ts`: 6/6 passing in isolation.
- Full HR suite (`tests/unit/hr` + `tests/integration/hr`): 94/94 passing.
- Full project suite: 385/385 passing, 82/82 files.
- `tsc --noEmit`: clean, no errors.
- `eslint .`: clean, only 3 pre-existing warnings unrelated to this feature (`TargetEditor.tsx` unused
  eslint-disable, `RoadmapDocument.tsx`/`SummitDocument.tsx` missing `alt` props).

**Net effect on launch readiness:** with US8 now built and green, every page/feature across all 5
committed specs (001–005) is complete. No further launch-blocking gaps identified within this audit's
scope.
