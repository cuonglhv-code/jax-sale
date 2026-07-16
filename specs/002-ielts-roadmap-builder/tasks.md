---
description: "Task list for IELTS Roadmap Builder (jax-sales slice #002)"
---

# Tasks: IELTS Roadmap Builder

**Input**: Design documents from `specs/002-ielts-roadmap-builder/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: TDD is **MANDATORY** (constitution Principle IV). Engine tests are exhaustive and land
**before any UI** — the ladder rules are the part that must not be wrong (brief non-negotiable).
Persistence/permission proofs run against the **live local Supabase stack, sequentially, no mocking**.

**Organization**: by user story. **Ordering rule (brief):** engine + its full test suite ship before
any UI. So phases run Setup → Foundational (content + persistence) → **Engine** (US2 no-skip → US3
overrides/append/timeline → US4 internal-warning barrier) → **PDF** (US6) → **UI** (US1 form → US5
review) → **Deliver+Log** (US7) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete tasks.
- **[Story]**: US1–US7 (user-story tasks only; Setup/Foundational/Polish carry no story label).
- Paths follow [plan.md](./plan.md) Architecture. Builds on the slice-#001 foundation.

⚠️ **Academic-team confirmations** (research D-A3/D-GP/D-INT): A3 policy = option (i), GP session
count = provisional placeholder, intensive rate = 4/week. Each is a **single isolated constant** in
the content store — coded against the recommended default, confirm before go-live (T046).

---

## Phase 1: Setup

- [X] T001 Add `@react-pdf/renderer` (^4.5.1) to `package.json`; place embedded fonts (Montserrat, Sansita) under `src/lib/ielts/pdf/fonts/`; `npm install`
- [X] T002 [P] Register permission key `roadmap.generate` in `src/lib/auth/permissions.ts`, granted to super_admin/centre_manager/centre_admin/sale_consultant (FR-ACCESS-01, FR-024a)
- [X] T003 [P] Add one nav/access-matrix entry (route `/lo-trinh-ielts`, label "Lộ trình IELTS", the 4 roles) to `NAV_ITEMS` in `src/lib/domain/vocabulary.ts` (FR-ACCESS-01, FR-024b)
- [X] T004 [P] Add Vietnamese labels for bands, audiences, intensities, exam purposes to `src/lib/domain/vocabulary.ts` (FR-CONTENT-02, SC-010)

---

## Phase 2: Foundational (content data + persistence — blocks all stories)

**⚠️ CRITICAL**: everything below blocks the engine and every user story.

### Content data (pure, academic-team-editable — FR-CONTENT-01)

- [X] T005 [P] Band scale + `bandValue()` ordered index in `src/lib/domain/ielts/bands.ts` (per data-model band scale)
- [X] T006 [P] Course ladder (all 10 courses: codes, entry/output bands, sessions, GP `sessionsProvisional`, roles, A3 policy-(i) flag, intensive rate constant) in `src/lib/domain/ielts/courses.ts` (FR-CONTENT-01; D-A3/D-GP/D-INT defaults)
- [X] T007 [P] Per-course-family narrative modules in `src/lib/domain/ielts/narrative/` (`booster-achiever.ts`, `foundation.ts`, `intensive.ts`, `pre-s-gp.ts`) matching each family's block shape (FR-CONTENT-01, FR-PDF-05)
- [X] T008 [P] Reference-roadmap baselines (6 audiences, as validation fixtures) in `src/lib/domain/ielts/reference-roadmaps.ts` (SC-003)
- [X] T009 [P] Two commitment thresholds (verbatim, distinct) in `src/lib/domain/ielts/thresholds.ts` (FR-PDF-02, SC-007)
- [X] T010 [P] Ecosystem list + brand tokens in `src/lib/domain/ielts/ecosystem.ts` and `src/lib/domain/ielts/brand.ts` (FR-PDF-03/04)

### Types, schema, persistence

- [X] T011 Domain types (`RoadmapRequest`, `Roadmap`, `RoadmapCourse`, `DeadlineWarning`, `StudentRoadmapView = Omit<Roadmap,"internalWarning">`, `RoadmapRecord`, `DeliveryResult`) in `src/services/ielts/types.ts` per [data-model.md](./data-model.md)
- [X] T012 Zod `RoadmapRequest` schema (email format; **refine target band > current band**; required fields) in `src/schemas/roadmap.ts` (FR-INPUT-02/03)
- [X] T013 Migration `supabase/migrations/*_roadmap_records.sql`: table + RLS (Pattern A broad-read/centre-narrow-write) + indexes (`centre_id`, `consultant_id`, `created_at`) + unique `generation_key`, per [contracts/rls-policies.md](./contracts/rls-policies.md) (FR-LOG-02)
- [X] T014 Apply migration (`supabase db reset`); verify table + 4 policies + indexes exist

**Checkpoint**: content + tenancy schema ready; the engine can be built and tested.

---

## Phase 3: User Story 2 — Roadmap never skips a level (Priority: P1) 🔒 NON-NEGOTIABLE 🎯 crown jewel

**Goal**: the engine outputs the contiguous ladder slice — no rung omitted.

**Independent Test**: for every entry/target pair, the sequence is the contiguous slice with correct
endpoints and no gap.

### Tests (write FIRST, MUST fail) ⚠️
- [X] T015 [P] [US2] Exhaustive no-skip test across ALL entry/target pairs (contiguous sub-array of rungs, correct start/end, zero gaps) in `tests/unit/ielts/engine.no-skip.test.ts` (SC-002, AC-2.4)

### Implementation
- [X] T016 [US2] Implement start-course resolution + contiguous slice in `src/services/ielts/roadmap-engine.ts` (pure; FR-ENGINE-01/05)

**Checkpoint**: no-skip invariant proven green across the whole ladder.

---

## Phase 4: User Story 3 — Overrides, Intensive append, timeline (Priority: P1)

**Goal**: audience overrides, A3 policy (i), INT auto-append, and timeline/completion maths.

**Independent Test**: each of the six reference audiences lands within its stated duration range.

### Tests (write FIRST, MUST fail) ⚠️
- [X] T017 [P] [US3] Test: audience overrides — "Mất gốc"→starts `PRE_S`; "THCS"→`GP` before `B1` in `tests/unit/ielts/engine.overrides.test.ts` (AC-3.2/3.3)
- [X] T018 [P] [US3] Test: INT auto-append rule (target ≥ 5.5 AND (exam date OR gap ≤ 0.5)) in `tests/unit/ielts/engine.append.test.ts` (AC-3.1)
- [X] T019 [P] [US3] Test: timeline maths + projected completion; six reference-audience duration-range checks in `tests/unit/ielts/engine.timeline.test.ts` (AC-3.4/3.5, SC-003)

### Implementation
- [X] T020 [US3] Extend engine: audience overrides + A3 policy (i) + INT append + timeline (rate 2.7 / 4) + completion date in `src/services/ielts/roadmap-engine.ts` (FR-ENGINE-02/03/04)

**Checkpoint**: full engine output correct; reference-range validation green.

---

## Phase 5: User Story 4 — Deadline warning is internal-only (Priority: P2) 🔒 structural barrier

**Goal**: the deadline warning reaches the consultant and is structurally impossible in the PDF.

**Independent Test**: warning shows in the consultant view; the PDF input type cannot carry it
(compile error).

### Tests (write FIRST, MUST fail) ⚠️
- [X] T021 [P] [US4] Type-level test: `StudentRoadmapView` has no `internalWarning`; the PDF document prop type is `StudentRoadmapView` (compile-time barrier) in `tests/unit/ielts/internal-warning-barrier.test.ts` (SC-006, AC-4.2)
- [X] T022 [P] [US4] Test: deadline warning present when projected completion > exam date; absent when no exam date in `tests/unit/ielts/engine.deadline.test.ts` (AC-4.1/4.3)

### Implementation
- [X] T023 [US4] Add `internalWarning` to `Roadmap` + `toStudentView()` (drops internal-only fields) in `src/services/ielts/roadmap-engine.ts` (FR-ENGINE-06)

**Checkpoint**: engine complete and fully tested; warning barrier is compile-enforced.

---

## Phase 6: User Story 6 — Branded PDF, thresholds, diacritics (Priority: P1)

**Goal**: on-brand PDF, 6 sections in order, both thresholds distinct, 100% Vietnamese diacritics.

**Independent Test**: render a multi-course PDF; verify section order, brand tokens, diacritics, and
both thresholds verbatim and separate.

### Tests (write FIRST, MUST fail) ⚠️
- [X] T024 [P] [US6] Test: commitments section renders BOTH thresholds distinctly & verbatim, never merged in `tests/unit/ielts/thresholds.test.ts` (SC-007, AC-6.2)
- [X] T025 [P] [US6] PDF render smoke test: Vietnamese diacritics + brand tokens present in `tests/unit/ielts/pdf-smoke.test.ts` (SC-004, AC-6.3/6.4)

### Implementation
- [X] T026 [US6] Font registration with the diacritic-safe rule (diacritics→Montserrat; Sansita ASCII-only) in `src/lib/ielts/pdf/fonts.ts` (AC-6.3, research D-PDF)
- [X] T027 [US6] `RoadmapDocument.tsx` + section components (Cover, Timeline strip, CourseCards, Commitments, Ecosystem, Contact) accepting **`StudentRoadmapView`** in `src/lib/ielts/pdf/` (AC-6.1/6.5/6.6)
- [X] T028 [US6] Course-card narrative rendering per family shape (Booster/Achiever 4-block; Foundation; Intensive) from the content store (FR-PDF-05, AC-6.7)

**Checkpoint**: a correct, on-brand, diacritic-safe PDF renders from engine output.

---

## Phase 7: User Story 1 — Input form + generate (Priority: P1)

**Goal**: consultant fills the Vietnamese form and generates a roadmap.

**Independent Test**: valid form → roadmap preview; invalid (target ≤ current / bad email / missing)
→ blocked with Vietnamese messages.

### Tests (write FIRST, MUST fail) ⚠️
- [X] T029 [P] [US1] Test: form validation — target ≤ current rejected, email format, required fields in `tests/unit/ielts/roadmap-schema.test.ts` (AC-1.2/1.3/1.4)

### Implementation
- [X] T030 [US1] Server page `src/app/(app)/lo-trinh-ielts/page.tsx` — gate via `getVerifiedClaims` + role check (deny teacher), load content + centres (FR-ACCESS-01, AC-1.6)
- [X] T031 [US1] `RoadmapForm.tsx` client form — all fields, band selects, intensity/purpose/audience, Zod validation (FR-INPUT-01/02/03)
- [X] T032 [US1] Wire engine client-side: form submit → `generateRoadmap` → preview state (AC-1.1)

**Checkpoint**: a consultant can generate and preview a roadmap end-to-end (read-only).

---

## Phase 8: User Story 5 — Review & edit (Priority: P2)

**Goal**: edit narrative inline, add a note, remove/reorder courses with a guarded, audited override.

**Independent Test**: remove a course → non-blocking warning; submit → `manual_edited = true`.

### Implementation
- [X] T033 [US5] `RoadmapReview.tsx` — renders identical to the PDF layout; inline narrative edit; "Ghi chú từ tư vấn viên" field (AC-5.1/5.2/5.3)
- [X] T034 [US5] Remove/reorder course → non-blocking "departs from standard ladder" warning + set `manualEdited` (AC-5.4/5.5)

**Checkpoint**: consultant can safely tailor the roadmap; overrides are flagged.

---

## Phase 9: User Story 7 — Deliver + log (Priority: P1) — security-proof

**Goal**: deliver the PDF and log every roadmap, centre-scoped, gated.

**Independent Test**: teacher denied; every submit writes a centre-scoped record + audit entry;
centre-A cannot touch centre-B records.

### Tests (write FIRST, MUST fail; live DB, no mocks) ⚠️
- [X] T035 [P] [US7] Permission-rejection test: `teacher` denied `roadmap.generate`, no write in `tests/integration/roadmap.perm.test.ts` (SC-008)
- [X] T036 [P] [US7] Centre-isolation test: centre-A cannot read/write centre-B `roadmap_records`, incl. a raw-INSERT RLS-bypass probe in `tests/integration/roadmap.isolation.test.ts` (isolation)
- [X] T037 [P] [US7] Log-completeness test: every submit writes a record (all FR-LOG-01 fields) + a `roadmap.generate` audit entry; idempotent on `generation_key` in `tests/integration/roadmap.log.test.ts` (FR-LOG-01/02, SC-005)

### Implementation
- [X] T038 [US7] `roadmap.service.ts` — `logRoadmapRecordCore` (insert + audit, idempotent) + `listRoadmapRecordsCore` (paginated, effective-centre) in `src/services/ielts/roadmap.service.ts` (client injectable) (FR-LOG-01/02)
- [X] T039 [US7] Server actions `submitRoadmap` + `listRoadmapRecords` (canonical pipeline) in `src/app/actions/roadmap/` per [contracts/roadmap.actions.md](./contracts/roadmap.actions.md)
- [X] T040 [US7] `DeliveryAdapter` interface + `DownloadMailDraftAdapter` (download PDF + prefilled Vietnamese `mailto:` draft) in `src/services/ielts/delivery/` per [contracts/delivery-adapter.md](./contracts/delivery-adapter.md) (FR-DELIVERY-01/02)
- [X] T041 [US7] Wire approve → render PDF + `adapter.deliver` + `submitRoadmap`; map `DeliveryResult`→`sent`; offline "logging pending" state (never silent) (AC-7.1/7.3, research D-OFFLINE)

**Checkpoint**: full vertical — generate → review → PDF → deliver → logged, gated and isolated.

---

## Phase 10: Polish & Cross-Cutting

- [X] T042 [P] Vietnamese-only audit: no raw enum id / English system string on any screen or PDF (SC-010)
- [X] T043 [P] Coverage ≥ 80% for engine + tenancy/permission boundaries; engine no-skip exhaustively covered (SC-009)
- [X] T044 [P] Enforce size limits (files < 800, functions < 50, nesting ≤ 4) + immutable patterns across new modules
- [ ] T045 Run [quickstart.md](./quickstart.md) scenarios 1–8; record results (SC-001/004/005/006/007)
- [X] T046 Confirm the three ⚠ academic-team values (A3 policy, GP sessions, intensive rate) are single-source constants; document pending-confirmation status

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → **Foundational (P2)**: content + schema block everything.
- **Engine (P3 US2 → P4 US3 → P5 US4)**: strictly ordered — slice core, then overrides/append/timeline, then the internal-warning barrier. **Lands before any UI (brief rule).**
- **PDF (P6 US6)**: depends on engine output + `StudentRoadmapView` (P5) + content (P2).
- **UI (P7 US1 → P8 US5)**: depends on the engine (P3–P5) and PDF (P6) for preview parity.
- **Deliver+Log (P9 US7)**: depends on the migration (P2), engine output, and PDF; its security-proof tests are the tenancy gate.
- **Polish (P10)**: after all desired stories.

### Within each story
- Tests written and **failing** before implementation (TDD). Content/types → engine → PDF → UI →
  persistence/delivery.

### Parallel opportunities
- **Setup**: T002–T004 [P]. **Foundational**: T005–T010 [P] (independent content files).
- **Engine test-first**: T017–T019 [P]; T021–T022 [P]. **PDF**: T024–T025 [P].
- **US7 security-proof**: T035–T037 [P] (different test files, must fail first).

---

## Parallel Example: Foundational content (Phase 2)

```bash
Task: "Band scale in src/lib/domain/ielts/bands.ts"                 # T005
Task: "Course ladder in src/lib/domain/ielts/courses.ts"            # T006
Task: "Narrative modules in src/lib/domain/ielts/narrative/"        # T007
Task: "Reference roadmaps in .../reference-roadmaps.ts"             # T008
Task: "Thresholds in .../thresholds.ts"                             # T009
Task: "Ecosystem + brand tokens in .../ecosystem.ts, brand.ts"     # T010
```

## Parallel Example: US7 security-proof tests (write first, must fail)

```bash
Task: "Permission-rejection test in tests/integration/roadmap.perm.test.ts"      # T035
Task: "Centre-isolation test in tests/integration/roadmap.isolation.test.ts"     # T036
Task: "Log-completeness test in tests/integration/roadmap.log.test.ts"           # T037
```

---

## Implementation Strategy

### MVP scope
Setup + Foundational + **US2 + US3 + US6 + US1 + US7** (all P1) = a consultant generates a
ladder-correct, on-brand, logged PDF and delivers it. US4 (internal warning — P2, but its type
barrier is built in P5 because the PDF depends on it) and US5 (review/edit — P2) are enhancements on
top.

### Incremental delivery
1. Setup + Foundational → content + schema ready.
2. + Engine (US2/US3/US4) → correct roadmaps, exhaustively tested (the part that must not be wrong).
3. + PDF (US6) → branded, diacritic-safe, thresholds-correct output.
4. + Form (US1) → consultant generates + previews.
5. + Deliver+Log (US7) → delivered + audited (security-proof green). **← shippable MVP.**
6. + Review/edit (US5) → tailoring with guarded overrides.
7. Polish → coverage, Vietnamese audit, quickstart, academic-team confirmations.

### Notes
- [P] = different files, no dependency on incomplete tasks.
- Tests MUST fail before implementation (verify red → green).
- The engine + its exhaustive tests land before any UI — the ladder rules must not be wrong.
- The three ⚠ academic values are isolated constants; confirming them is data-only (T046).
