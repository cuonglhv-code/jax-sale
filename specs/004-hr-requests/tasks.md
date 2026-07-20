---
description: "Task list for HR Requests module (slice 004)"
---

# Tasks: HR Requests Module

**Input**: Design documents from `specs/004-hr-requests/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED and TEST-FIRST — the constitution (Principle IV, NON-NEGOTIABLE) mandates TDD,
≥80% coverage, a permission-rejection test per mutating action, a centre-isolation test per RLS table,
plus this slice's medical-doc **confidentiality** proof and balance **no-double-spend** proof. Auth/DB
are NOT mocked for the security proofs — they run against a live local Supabase stack, sequentially.

**Organization**: Grouped by user story. MVP = Setup + Foundational + **US1 + US3 + US2** (submit annual
leave → ledger → decide). Within P1 the dependency order is US1 → US3 → US2 (approving annual leave
consumes balance, so the ledger's guarded function must exist before the approve path calls it).

## Format: `[ID] [P?] [Story] Description`

- **[P]** = parallelizable (different files, no dependency on an incomplete task)
- **[Story]** = US1..US8 (maps to spec.md user stories); Setup/Foundational/Polish carry no story label

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add dependencies (`resend`, `@react-email/components`, `papaparse` + `@types/papaparse`) to `package.json` and install
- [X] T002 [P] Add `RESEND_API_KEY` and `CRON_SECRET` to startup env validation in `src/lib/env.ts` (fail-fast)
- [X] T003 [P] Declare the private `medical-documents` bucket (size/MIME limits) in `supabase/config.toml`; note the full `supabase stop && start` + `db reset` reload gotcha in a comment
- [X] T004 [P] Extract shared form field components (`Field`, `SelectField`, `DateField`, `FileField`) from `src/app/(app)/tasks/*` into `src/components/form/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

> **Implementation note (timestamps):** `20260716130001` was already taken by slice-003
> (`roadmap_records`), so the HR migrations were created as `20260717130001_employees_hr_cols.sql`
> (T005), `20260717130002_hr_schema.sql` (T006), and `20260717130003_hr_rls.sql` (T010) to avoid
> collision. Filenames below are the originally-planned names.

- [X] T005 Migration `supabase/migrations/20260716130001_employees_hr_cols.sql` — add `hire_date`, `employment_type` (CHECK ∈ EmploymentType), `contract_type` (CHECK ∈ ContractType) to `public.employees`; backfill defaults
- [X] T006 Migration `supabase/migrations/20260716130002_hr_schema.sql` — create `hr_request`, `hr_request_status_history`, `cover_assignment`, `request_attachment`, `leave_balance`, `leave_policy_config`, `leave_event_allowance`, `public_holiday`, `doc_type_policy`, `class` (columns + CHECK enums + indexes per [data-model.md](./data-model.md))
- [X] T007 [P] Add HR enums (`RequestType`, `RequestStatus`, `LeaveDayPart`, `CoverStatus`, `EmploymentType`, `ContractType`, `PersonalLeaveEvent`) as `as const` tuples + camelCase entity interfaces to `src/lib/data/types.ts`
- [X] T008 [P] Add HR `<ENUM>_LABEL` Vietnamese maps + `/nhan-su` sub-route `NAV_ITEMS` entries (role-scoped) to `src/lib/domain/vocabulary.ts`
- [X] T009 [P] Append HR permission keys (`hrRequest.submit|decide|cancel`, `cover.respond`, `timetable.manage`, `hrConfig.manage`, `leaveBalance.adjust`, `hrReport.view`) + `ROLE_GRANTS` to `src/lib/auth/permissions.ts`
- [X] T010 Migration `supabase/migrations/20260716130003_hr_rls.sql` — RLS for every HR table per [contracts/rls-policies.md](./contracts/rls-policies.md) (restricted-read on `hr_request`/`leave_balance`; centre-narrow write; Pattern B for config; Pattern A for `class`)
- [X] T011 [P] Pure working-days utility in `src/lib/hr/working-days.ts` (count vs configurable working-week, exclude holidays, half-day = 0.5)
- [X] T012 [P] `FormDefinition` registry types + empty registry in `src/lib/domain/hr-forms.ts`
- [X] T013 Extend `supabase/seed.sql` (idempotent) — classes per centre, `leave_policy_config` for current year, holidays, employee `hire_date`/`employment_type`, a few sample requests; RFC-4122-shaped UUIDs
- [X] T014 HR live-local test harness + **storage fixture setup/teardown** (`tests/integration/hr/_setup.ts`) — seed.sql seeds Postgres only, so storage objects need explicit fixtures (research R8)

**Checkpoint**: Foundation ready — schema, enums, vocabulary, permissions, RLS, engine scaffold in place.

---

## Phase 3: User Story 1 — Submit a request in < 60s (Priority: P1) 🎯 MVP

**Goal**: An employee submits an annual-leave request (one form type, end-to-end) → pending, centre-scoped.
**Independent Test**: Log in as `teacher`; submit annual leave on a phone-width viewport; it appears in "My requests" and is visible to the centre manager.

### Tests (write first, must fail)

- [X] T015 [P] [US1] Unit test working-days + annual-leave schema in `tests/unit/hr/working-days.test.ts`
- [X] T016 [P] [US1] Integration: submit annual leave → `pending` + centre from claims + `from_status=null` history row, in `tests/integration/hr/us1-submit.test.ts`
- [X] T016a [P] [US1] Integration: submitting leave that overlaps the submitter's own pending/approved leave is rejected with a Vietnamese message, in `tests/integration/hr/us1-self-overlap.test.ts`
- [X] T017 [P] [US1] Permission test: unauthenticated / inactive employee submit rejected, in `tests/integration/hr/us1-submit-auth.test.ts`

### Implementation

- [X] T018 [US1] Migration `supabase/migrations/20260717130004_hr_fn_submit.sql` — `create_hr_request_with_log(...)` (atomic: request + initial history row; US1 passes no cover rows — US4/T042 extends), SECURITY INVOKER
- [X] T019 [P] [US1] `annual_leave` Zod schema in `src/schemas/hr/submit.ts` + register its `FormDefinition` in `src/lib/domain/hr-forms.ts`
- [X] T020 [US1] `submit-request.ts` Server Action + `submitRequestCore` in `src/services/hr-request.service.ts` (pipeline: `withError → assertPermission('hrRequest.submit') → schema.parse → create RPC → write_audit_log`) — depends on T018, T019
- [X] T020a [US1] Add a self-overlap guard to `submitRequestCore` in `src/services/hr-request.service.ts`: reject a leave request whose date range overlaps the submitter's own non-terminal (pending/awaiting_cover/approved) leave, with a friendly Vietnamese `DomainError` (shared submit path — applies to all leave-family types; edge case) — depends on T020
- [X] T021 [P] [US1] `useSubmitRequest` mutation + `useMyRequests` query hooks in `src/hooks/{mutations,queries}/hr/`
- [X] T022 [US1] `/yeu-cau` page (NOT `/nhan-su` — that route's `personnel` NAV_ITEM is role-restricted to super_admin/centre_manager; a new top-level route + `hrRequests` NAV_ITEM keeps this surface reachable by every role and avoids a future file collision with slice-001's personnel-management page): form-type picker + schema-driven annual-leave form + inline remaining-balance display, in `src/app/(app)/yeu-cau/page.tsx`

**Checkpoint**: Annual-leave submission works end-to-end.

---

## Phase 4: User Story 3 — Annual-leave balance ledger (Priority: P1)

**Goal**: Entitlement computed; consumed on approval; restored on cancel; over-balance warns; no double-spend.
**Independent Test**: Approve an annual-leave request → balance drops by exactly the working-days; withdraw → restored; two concurrent approvals never over-draw beyond a recorded discretionary over-draw.
*(Built before US2 because `approve_request` calls the ledger's consume function.)*

### Tests (write first, must fail)

- [X] T023 [P] [US3] Unit: entitlement compute (baseline + seniority + mid-year/part-time prorate) in `tests/unit/hr/entitlement.test.ts`
- [X] T024 [P] [US3] Integration: approve annual → `consumed_days += D`; withdraw → restored, in `tests/integration/hr/us3-ledger.test.ts`
- [X] T025 [P] [US3] Integration: two concurrent approvals do not double-spend (row lock), in `tests/integration/hr/us3-no-double-spend.test.ts`

### Implementation

- [X] T026 [US3] Migration `supabase/migrations/20260717130005_hr_fn_balance.sql` — `recompute_entitlement`, `consume_leave_balance`/`restore_leave_balance` (with `SELECT … FOR UPDATE`), `adjust_opening_balance` (super_admin, audited). Built SECURITY DEFINER (deviation — see task report) since `leave_balance` has no authenticated write grant.
- [X] T027 [P] [US3] `leave-balance.service.ts` (entitlement wrapper, adjust) + `src/schemas/hr/balance.ts`
- [X] T028 [P] [US3] `adjust-balance.ts` action (key `leaveBalance.adjust`) + `get-my-balance.ts` action + `useLeaveBalance` query hook + `useAdjustBalance` mutation hook
- [X] T029 [US3] Wire the over-balance **warning** (recompute at submit; indicative only) into `submitRequestCore` + a balance-impact display component

**Checkpoint**: Ledger is trustworthy — consume/restore/over-balance/no-double-spend all proven.

---

## Phase 5: User Story 2 — Approve / reject from one queue (Priority: P1)

**Goal**: Centre manager decides own-centre requests from one screen; approve consumes balance (annual) with a **fresh** recompute; reject requires a reason; self-approval forbidden; decisions audited & immutable.
**Independent Test**: As `centre_manager`, approve one and reject one (reason required) from the queue; both leave it; submitter sees status; each decision is in `audit_log` + history.

### Tests (write first, must fail)

- [X] T030 [P] [US2] Permission test: non-manager `decideRequest` rejected, in `tests/integration/hr/us2-decide-auth.test.ts`
- [X] T031 [P] [US2] Centre-isolation: manager of centre B cannot read/decide a centre-A request, in `tests/integration/hr/us2-isolation.test.ts`
- [X] T032 [P] [US2] Integration: approve → `approved` + history + audit + balance consumed (fresh recompute); reject requires reason; self-approval routes to super_admin, in `tests/integration/hr/us2-decide.test.ts`
- [X] T032a [P] [US2] Integration: deactivating an employee who has a pending/awaiting_cover request auto-closes it (consumed balance restored, covers released, audited), in `tests/integration/hr/us2-deactivate-pending.test.ts`

### Implementation

- [X] T033 [US2] Migration `supabase/migrations/20260717130006_hr_fn_decide.sql` — `approve_request` (status flow + all-covers-accepted check + self-approval guard + calls `consume_leave_balance`; idempotent via `status='pending'` re-checked AFTER row lock) and `reject_request` (requires reason); also `cancel_or_withdraw_request` (T037) in the same file. Named with the `20260717…` HR-slice timestamp prefix (not `20260716…` as originally drafted) to sort after T026 (`20260717130005_hr_fn_balance.sql`), which it depends on.
- [X] T034 [US2] `decide-request.ts` action + `decideRequestCore` in `src/services/hr-request.service.ts`
- [X] T035 [P] [US2] `useDecideRequest` mutation + `useApprovalQueue` query (sorted soonest-start) hooks — `hasAttachment` projection deferred to US6 (no attachments exist until then)
- [X] T036 [US2] Approval queue UI `src/app/(app)/nhan-su/duyet/page.tsx` — rows show who/what/when/working-days/status; approve button; reject opens an inline reason prompt (plain state) requiring non-empty text. Cover/session status deferred to US4 (no cover_assignment rows exist until then).
- [X] T037 [US2] `cancel-request.ts` action + `cancel_or_withdraw_request` RPC (restore balance on withdraw; release covers) + `useCancelRequest` hook
- [X] T037a [US2] Extend slice-001 `deactivateEmployeeCore` (`src/services/personnel.service.ts`) to call a new `closePendingRequestsFor(employeeId)` path in `src/services/hr-request.service.ts`: cancel the employee's pending/awaiting_cover requests, restore any consumed balance, release covers, write history + audit (edge case: submitter leaves while pending) — surgical cross-slice extension; depends on T026, T037

**Checkpoint**: 🎯 **MVP complete** — annual leave submitted, balance-tracked, and decided, fully audited.

---

## Phase 6: User Story 4 — Class conflict detection & cover (Priority: P2)

**Goal**: Leave overlapping taught sessions requires an accepted same-centre cover before approval; shift-swap uses the same mechanism.
**Independent Test**: Submit leave overlapping a class → `awaiting_cover`; nominating a double-booked teacher is blocked; nominee accepts → `pending`; approve blocked until accepted.

### Tests (write first, must fail)

- [X] T038 [P] [US4] Unit: conflict resolver (overlap, holiday exclusion, half-day AM/PM, recurrence edges, inactive class) in `tests/unit/hr/conflict.test.ts`
- [X] T039 [P] [US4] Integration: conflict → cover required + hard-conflict nominee blocked + accept → pending + approve gated, in `tests/integration/hr/us4-cover.test.ts`
- [X] T039a [P] [US4] Integration: a cover declined AFTER approval, and a class/session deactivated after cover was arranged, each → cover released, request flagged for re-resolution, manager+submitter notified, in `tests/integration/hr/us4-cover-reresolution.test.ts`

### Implementation

- [X] T040 [US4] Pure conflict resolver `src/lib/hr/conflict.ts` (`resolveAffectedSessions(...)`)
- [X] T041 [US4] `upsert-class.ts` action + `upsert_class` RPC (same-centre teacher guard) + `useClasses` hook + `/nhan-su/lich-day` timetable admin UI
- [X] T042 [US4] Extend `create_hr_request_with_log` + `submitRequestCore` to create `cover_assignment` rows, set `awaiting_cover`, and block a hard-conflicting nominee (same-centre pool)
- [X] T043 [US4] `respond-cover.ts` action + `respond_cover` RPC + `useMyCoverNominations` hook + accept/decline UI
- [X] T043a [US4] Post-approval cover disruption in `src/services/cover.service.ts` + migration `supabase/migrations/20260720130005_hr_fn_cover_reresolution.sql`: `release_cover_and_flag(cover_id)` RPC sets the `cover_assignment` → `released`, marks the owning request for re-resolution (`hr_request.needs_reresolution` boolean — see migration comment for why a new RequestStatus value was rejected), writes audit; wired into `respond_cover` (decline of an already-accepted cover) and `upsert_class` (deactivating a class releases its accepted covers) — depends on T041, T042, T043. In-app notify only (no email — US7 not yet built); the `needs_reresolution` flag is the durable "notify" signal for this slice.
- [X] T044 [US4] Register `shift_swap` `FormDefinition` reusing the cover mechanism standalone (no leave)

**Checkpoint**: No approved leave can leave a taught session uncovered (SC-003).

---

## Phase 7: User Story 5 — All nine forms on one engine (Priority: P2)

**Goal**: The eight remaining form types run through the same engine with correct per-type validation & side effects.
**Independent Test**: Submit one of each type; each renders correct fields/validation, routes to the manager, and performs its correct side effect (only annual draws balance; money forms notify accounting on approval).

### Tests (write first, must fail)

- [X] T045 [P] [US5] Integration: each of the 8 remaining types submits with correct validation + side-effect flag, in `tests/integration/hr/us5-forms.test.ts`

### Implementation

- [X] T046 [P] [US5] Zod schemas for `sick_leave`, `personal_leave`, `unpaid_leave`, `overtime`, `salary_advance`, `purchase`, `business_travel` in `src/schemas/hr/`
- [X] T047 [US5] Register all `FormDefinition`s (fields, `requiresDocument`, `isMoneyForm`, `conflictScoped`, `sideEffect`) in `src/lib/domain/hr-forms.ts`
- [X] T048 [US5] Money-form accounting notification hook in `decideRequestCore` (notify super_admin-as-accounting on approval; router built to admit a future 2nd step) — TODO-flagged only; real send is US7 (notification infra doesn't exist yet)
- [X] T049 [US5] Extend the schema-driven renderer to cover all field kinds (date, number, textarea, select, file) in the picker UI — implemented as per-type form components (`LeaveFamilyForm`, `OvertimeForm`, `SalaryAdvanceForm`, `PurchaseForm`, `BusinessTravelForm`) matching the existing hand-coded convention, not a generic field-kind renderer (file kind deferred to US6, no upload UI exists yet)

**Checkpoint**: All nine forms work on the single engine.

---

## Phase 8: User Story 6 — Documentation upload with protected access (Priority: P2)

**Goal**: Sick/personal-leave attachments stored privately; medical docs visible only to approver + super_admin; never in lists/exports/emails.
**Independent Test**: Attach a medical doc; approver + super_admin can open it (signed URL); a peer cannot; it never appears in any projection.

### Tests (write first, must fail)

- [X] T050 [P] [US6] **Confidentiality proof**: peer denied metadata + object; centre manager can sign; centre-B manager cannot; absent from all projections, in `tests/integration/hr/us6-confidentiality.test.ts`
- [X] T051 [P] [US6] Integration: sick leave requires an attachment; type/size enforced (byte-level), in `tests/integration/hr/us6-upload.test.ts`

### Implementation

- [X] T052 [US6] Migration `supabase/migrations/20260720130006_hr_storage.sql` — `storage.objects` RLS for `medical-documents` per [contracts/storage-policies.md](./contracts/storage-policies.md). `request_attachment` RLS already existed from the foundation `hr_rls` migration (20260717130003) — confirmed, nothing duplicated. Named with the next available `20260720…` HR-slice timestamp (not `20260716130007` as originally drafted) to sort after the latest existing migration.
- [X] T053 [US6] `upload-attachment.ts` + `get-attachment-url.ts` actions + `attachment.service.ts` — upload via service-role (byte-MIME sniff + size, no new dependency) and signed-URL view **after** an app-layer gate that reads through the service-role client (see task report — RLS would otherwise mask an ineligible caller's request as a false "not found" instead of the required `ForbiddenError`)
- [X] T054 [US6] Enforce `doc_type_policy` (byte-level sniff + size vs. the already-seeded policy rows); expose only `hasAttachment` in `listMyRequestsCore`/`listApprovalQueueCore` projections (`purge_after`/cron auto-purge is T063, Polish phase — not part of this story's scope)
- [X] T055 [US6] File-upload UI in `LeaveFamilyForm.tsx` (sick/personal forms) + approver signed-URL viewer in `ApprovalQueueBoard.tsx` (indicator + on-demand button only, never in the row body)

**Checkpoint**: Medical-doc confidentiality proven at the storage layer (SC-006).

---

## Phase 9: User Story 7 — Notifications (Priority: P3)

**Goal**: Vietnamese transactional email at each transition; approver reminders; never leaks attachment content.
**Independent Test**: Trigger each transition → correct recipient gets a Vietnamese email; no body contains attachment content.

### Tests (write first, must fail)

- [ ] T056 [P] [US7] Integration (test transport): each trigger emails the correct recipient; no attachment content in any body, in `tests/integration/hr/us7-notify.test.ts`

### Implementation

- [ ] T057 [P] [US7] React Email templates (Vietnamese, narrow props — no attachment field) in `src/emails/`
- [ ] T058 [US7] `notification.service.ts` (Resend send fns; non-fatal `try/catch`) wired into submit/decide/cover/money `*Core` after the audit write
- [ ] T059 [US7] Pending-reminder cron route `src/app/api/cron/pending-reminders/route.ts` (CRON_SECRET-gated) + `vercel.json`/`vercel.ts` crons entry

**Checkpoint**: Notifications flow; medical content never in email (FR-037).

---

## Phase 10: User Story 8 — Reporting (Priority: P3)

**Goal**: Leave-by-employee/centre/period, requests by type/status, outstanding balances, and a "who is off & who is covering" view — all exportable, role-scoped, no medical content.
**Independent Test**: Produce the coverage view + a leave-by-employee report; export; confirm no medical content.

### Tests (write first, must fail)

- [ ] T060 [P] [US8] Integration: coverage view + leave-by-employee report scoped by role, exportable, no medical content, in `tests/integration/hr/us8-report.test.ts`

### Implementation

- [ ] T061 [P] [US8] Report aggregation SQL functions/queries (paginated, no N+1): leave taken, by type/status, outstanding balances, coverage join
- [ ] T062 [US8] `/nhan-su/bao-cao` UI + CSV export via `papaparse`

**Checkpoint**: HR can answer "who is off next week and who is covering" unaided (SC-007).

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T063 [P] Medical-doc auto-purge cron route `src/app/api/cron/purge-documents/route.ts` (sweep `purge_after < today`; delete object then row; audit) + `vercel.json` crons entry
- [ ] T064 [P] Leave-policy config UI `/nhan-su/cau-hinh` (super_admin) with a prominent "figures require HR/legal sign-off" banner (FR-030)
- [ ] T065 [P] Vocabulary completeness pass — no raw enum id renders anywhere (Principle I)
- [ ] T066 Coverage top-up to ≥80% (unit: form-definition validation, working-days & entitlement edge cases, leave-year-boundary split)
- [ ] T067 Run [quickstart.md](./quickstart.md) V1–V7 + security proofs S1–S4 against the live local stack; fix any drift
- [ ] T068 [P] Walk the VERIFY-AT-IMPLEMENTATION register ([research.md](./research.md) R12) against live docs/stack before merge (Resend/React 19, Vercel Cron auth+limits, `supabase-js` storage signatures, byte-MIME, Next 16 Server-Action body size)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **BLOCKS all stories**.
- **P1 stories** run in dependency order **US1 → US3 → US2** (approve consumes balance).
- **US4, US5** depend on the US1 engine (and US4 on the timetable from its own phase); independently testable.
- **US6** depends on US5 (sick/personal forms) + storage setup.
- **US7, US8** depend on the request/decision data existing; additive.
- **Polish** depends on the desired stories being complete.

### Story dependencies

- **US1 (P1)**: after Foundational.
- **US3 (P1)**: after US1 (needs a submittable annual-leave request to consume).
- **US2 (P1)**: after US3 (approve calls the ledger).
- **US4 (P2)**: after US1; adds timetable + cover.
- **US5 (P2)**: after US1 (registers the other 8 definitions).
- **US6 (P2)**: after US5.
- **US7 (P3)** / **US8 (P3)**: after the actions/data they observe exist.
- **Edge-case remediation tasks**: T020a (self-overlap) depends on T020; T037a (auto-close on
  deactivation) depends on slice-001 `deactivateEmployeeCore` + T026/T037 (balance restore, cover
  release); T043a (post-approval cover disruption) depends on T041/T042/T043 (timetable + cover).

### Parallel opportunities

- Setup: T002, T003, T004 in parallel.
- Foundational: T007, T008, T009, T011, T012 in parallel (after the T005/T006 migrations); T010 after T006.
- Within each story, the `[P]` test tasks run together first; then `[P]` schemas/hooks; then the sequential service/UI/migration tasks.
- Different developers can take US4 / US5 in parallel once US1 is done (US4 = timetable+cover; US5 = remaining forms) — they touch different files.

---

## Parallel Example: User Story 1

```bash
# Tests first (write, ensure they FAIL):
Task: "Unit working-days + annual schema — tests/unit/hr/working-days.test.ts"
Task: "Integration submit annual → pending+history — tests/integration/hr/us1-submit.test.ts"
Task: "Permission: inactive submit rejected — tests/integration/hr/us1-submit-auth.test.ts"

# Then parallel schema + hooks:
Task: "annual_leave Zod schema + FormDefinition — src/schemas/hr/submit.ts, src/lib/domain/hr-forms.ts"
Task: "useSubmitRequest + useMyRequests — src/hooks/{mutations,queries}/hr/"
```

---

## Implementation Strategy

### MVP first (US1 + US3 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. US1 (submit annual leave) → US3 (ledger) → US2 (decide).
3. **STOP & VALIDATE**: quickstart V1–V3 + proofs S1, S2, S4. This is a demonstrable annual-leave
   request-and-approval system with a trustworthy balance and full audit — deploy/demo.

### Incremental delivery

- +US4 (conflict/cover) → validate SC-003.
- +US5 (all nine forms) → validate the engine.
- +US6 (documentation) → validate confidentiality proof S3 / SC-006.
- +US7 (notifications) → +US8 (reporting) → validate SC-007.
- Polish (auto-purge cron, config UI, coverage, quickstart run).

### Definition of done (per constitution)

Security proofs S1–S4 green; the working vertical exercised by each of the five roles per its rights;
≥80% coverage; every statutory figure flagged as requiring HR/legal sign-off before launch.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Every mutating action reuses the canonical pipeline; new permission keys append to the single registry
  (no parallel systems — FR-044).
- Migrations are append-only, timestamp-prefixed; later files `create or replace` earlier functions
  rather than editing them (matching slice-001 convention).
- After any `supabase/config.toml` change (T003): full `supabase stop && start`, then `db reset`.
- Commit after each task or logical group; nothing is committed to git yet for this repo — ask before the first commit.
