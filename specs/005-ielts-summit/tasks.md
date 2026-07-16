# Tasks: Jaxtina IELTS Summit

**Input**: Design documents from `/specs/005-ielts-summit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — TDD is constitutionally mandatory (Development Workflow gates), with named
test obligations for Principles II, III, IV, V, IX. Every test task is written first and MUST
fail before its implementation task starts.

**Organization**: Tasks are grouped by user story (spec.md priorities P1–P5) so each story is an
independently testable increment. Feature 002 modules are reused, never duplicated (research
D-REUSE).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 from spec.md; Setup/Foundational/Polish tasks carry no story label

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New content-data modules and brand tokens every story reads (Principle VII).

- [ ] T001 [P] Create summit copy module (provisional caveat, estimate framings, CTA, warnings,
      send success/failure messages, email subject/body templates, summary labels — all
      Vietnamese) in src/lib/domain/ielts/summit-copy.ts
- [ ] T002 [P] Create per-centre price list content module (PRICES: Record<CentreKey,
      Partial<Record<CourseCode, number>>>, PRICE_DISPLAY.unpricedLabelVi) with realistic
      placeholder VND values in src/lib/domain/ielts/pricing.ts
- [ ] T003 [P] Extend brand tokens with mountain palette (atmosphere layers), mascot-as-climber
      asset refs, and the Sansita tagline lockup SVG reference in src/lib/domain/ielts/brand.ts
      (+ asset files under public/brand/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types and validation gates every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Define summit domain types — Placement discriminated union (measured/estimated),
      SummitRequest, SummitStage (state: below/climb/above; sessions/price nullable),
      SummitRoadmap (duration ranges, totalPrice with excludesUnpriced), SummitInputError,
      exhaustive-switch helper — in src/services/ielts/summit-types.ts (per data-model.md)
- [ ] T005 [P] Content-module validation test: Zod-parse pricing/copy/brand modules (known
      centre keys, non-empty Vietnamese strings, every climbable course priced or explicitly
      unpriced) in tests/unit/ielts/content-data.test.ts
- [ ] T006 [P] Zod boundary schemas — summitRequestSchema (targetBand > currentBand refinement),
      captureSchema, sendSummitRoadmapSchema (generationKey, pdf payload) — in
      src/schemas/summit.ts

**Checkpoint**: Foundation ready — user story phases can begin.

---

## Phase 3: User Story 1 - Present the Climb (Priority: P1) 🎯 MVP

**Goal**: Consultant sets name + bands and walks the family up a bottom-to-top mountain:
illuminated contiguous slice, one-stage-at-a-time narrative with price, live summary, instant
target changes — fully offline once loaded.

**Independent Test**: With network disabled, set bands 4.5→7.0: correct climb (B2→A1→A2→A3+INT),
expand every stage one at a time, summary shows 128 buổi / duration range / arithmetic total;
change target mid-flow with no data loss (quickstart Scenario 1).

### Tests for User Story 1 (write first — MUST fail before T010)

- [ ] T007 [P] [US1] Engine unit tests: exhaustive all-band-pair contiguity property (climb is a
      subarray of RUNGS + optional trailing INT — Principle II / SC-004), INT append iff target
      ≥ 5.5 ∧ gap ≤ 0.5 (FR-003), degenerate inputs throw SummitInputError with inputs
      recoverable, "below A1" starts at PRE_S, stage states below/climb/above — in
      tests/unit/ielts/summit-engine.test.ts
- [ ] T008 [P] [US1] Pricing unit tests: total = arithmetic sum of climb stage prices for the
      centre's list, unpriced stage → excludesUnpriced flag + excluded from sum, no discount
      fields exist (FR-016) — in tests/unit/ielts/summit-pricing.test.ts
- [ ] T009 [P] [US1] Timeline unit tests: weeks = sessions/2.7, months = weeks/4.33, output is
      always a min–max range never a point (FR-004), PRE_S contributes no sessions and sets the
      flexible-duration note (research D-PRES) — in tests/unit/ielts/summit-timeline.test.ts

### Implementation for User Story 1

- [ ] T010 [US1] Implement pure summit engine (generateSummitRoadmap: shared 002 slice logic +
      FR-003 append + stage states + pricing totals + timeline ranges + mode carriage) in
      src/services/ielts/summit-engine.ts — T007–T009 go green
- [ ] T011 [US1] Opening controls (student name, current band, target band selects from
      bands.ts options; refuses target ≤ current with Vietnamese prompt, inputs preserved) in
      src/app/(app)/lo-trinh-ielts/OpeningControls.tsx
- [ ] T012 [P] [US1] Mountain scene (layered SVG/CSS, bottom-to-top always, illuminate climb /
      dim below / recede-reachable above, student name on the mountain, transform+opacity-only
      motion ≤ 300ms interruptible, prefers-reduced-motion instant) in
      src/app/(app)/lo-trinh-ielts/Mountain.tsx
- [ ] T013 [P] [US1] Stage panel (one-at-a-time accordion; tier shapes per FR-009 —
      Booster/Achiever 4 blocks + weighted "Nút thắt thật sự" + 3-row progression table,
      Foundation strands + goals, Intensive 3 columns; per-stage price with unpriced label) in
      src/app/(app)/lo-trinh-ielts/StagePanel.tsx
- [ ] T014 [P] [US1] Summary surface (total buổi, duration range, projected finish window,
      total price + excludesUnpriced note, Pre-S flexible note) in
      src/app/(app)/lo-trinh-ielts/SummarySurface.tsx
- [ ] T015 [US1] Summit shell — state map with every state one action from every other
      (contracts/presentation.md table), engine wiring, instant target re-render, no autoplay/
      sound — in src/app/(app)/lo-trinh-ielts/Summit.tsx + page.tsx wiring
- [ ] T016 [US1] UI behaviour tests: exactly one stage expanded at a time, DOM stage order is
      bottom-to-top, target change re-renders without losing name, one-action reachability of
      summary from any stage — in tests/unit/ielts/summit-ui.test.tsx

**Checkpoint**: MVP — the live presentation works end to end, offline, without send.

---

## Phase 4: User Story 2 - Distinguish Measured from Provisional (Priority: P2)

**Goal**: Mode A/B as a structural data distinction: Mode B is unmissably provisional on screen
and on every document, with the named caveat, estimate framing, and book-a-test CTA.

**Independent Test**: Same bands in both modes: renderings visibly distinct; Mode B carries the
literal caveat and CTA; no path yields a confirmed-looking Mode B output (quickstart Scenario 2).

### Tests for User Story 2 (write first — MUST fail before T019)

- [ ] T017 [P] [US2] Mode rendering tests: estimated placement renders the exact caveat string
      from summit-copy.ts + estimate framing on duration/price + CTA; measured renders none of
      it; estimated→measured transition clears the treatment everywhere at once — in
      tests/unit/ielts/placement-mode.test.tsx
- [ ] T018 [P] [US2] Structural tests: renderer components accept only the Placement union
      (compile-time exhaustiveness — assert no boolean/optional-prop bypass exists; type-level
      assertions) in tests/unit/ielts/placement-types.test.ts
- [ ] T019 [US2] Mode selection in opening (Mode A with test date / Mode B) + record-placement-
      result flow flipping B→A, in src/app/(app)/lo-trinh-ielts/OpeningControls.tsx (evolve)
- [ ] T020 [US2] Provisional treatment across the scene: distinct start-marker rendering in
      Mountain.tsx, estimate framing in SummarySurface.tsx, caveat + CTA placement in
      Summit.tsx (all copy from summit-copy.ts)
- [ ] T021 [US2] PDF cover takes the Placement union; the estimated branch IS the prominent
      cover caveat (no flag prop) — evolve src/lib/ielts/pdf/RoadmapDocument.tsx cover section

**Checkpoint**: US1 + US2 — measured and provisional climbs are structurally distinct.

---

## Phase 5: User Story 3 - Send the Summit Document (Priority: P3)

**Goal**: Review-exactly-what-they-get → capture → branded PDF (spec section order) → email +
byte-identical archive with metadata → loud failure preserving work → one-action reset.

**Independent Test**: From a prepared consultation: edit inline, remove a course (warning),
capture, send; email arrives; archive row + object byte-identical; simulated failure loses
nothing; reset warns then clears PII (quickstart Scenario 4).

### Tests for User Story 3 (write first — MUST fail before T025)

- [ ] T022 [P] [US3] Migration for summit_sends (columns per data-model.md, generation_key
      UNIQUE, no UPDATE/DELETE policies) + private storage bucket roadmap-archive + RLS
      (centre-confined INSERT, audit-permission SELECT) in
      supabase/migrations/<timestamp>_summit_sends.sql
- [ ] T023 [P] [US3] Integration tests against local Supabase (real DB, no mocks — house rule):
      permission gate rejects unauthorized caller, centre A cannot write centre B, same
      generationKey twice → one row/object, provider failure → { error } with no delivered row,
      archived object byte-identical to input PDF — in tests/integration/summit-send.test.ts
- [ ] T024 [P] [US3] PDF content tests: section order exactly cover → timeline → course cards →
      Cam kết → Hệ sinh thái → contact (FR-021), content identity with the SummitRoadmap source
      (SC-003), both thresholds verbatim from thresholds.ts (SC-005), timeline bottom-to-top —
      in tests/unit/ielts/summit-pdf.test.tsx

### Implementation for User Story 3

- [ ] T025 [US3] Evolve the PDF document to the summit shape (spec section order, climb
      timeline rendered bottom-to-top, per-course narrative + price cards, ecosystem items from
      ecosystem.ts, contact block) in src/lib/ielts/pdf/RoadmapDocument.tsx — T024 goes green
- [ ] T026 [US3] Review screen: preview from the same SummitRoadmap the PDF consumes, inline
      narrative editing, "Ghi chú từ tư vấn viên" above courses, dnd-kit remove/reorder with
      departs-from-standard-ladder warning setting manualEdited — in
      src/app/(app)/lo-trinh-ielts/ReviewSend.tsx
- [ ] T027 [US3] Capture form (student email/phone, consultant name/phone/email; Zod
      captureSchema; centre from verified claims, never client input) in ReviewSend.tsx +
      src/schemas/summit.ts wiring
- [ ] T028 [US3] Send pipeline: EmailSendAdapter behind the 002 DeliveryAdapter seam in
      src/services/ielts/delivery/email-send.ts + send-summit-roadmap server action
      (withError → assertPermission("roadmap.send") → parse → upload PDF → insert row
      on-conflict-do-nothing → email via env-validated provider) in
      src/app/actions/roadmap/send-summit-roadmap.ts
- [ ] T029 [US3] Loud-failure UX: blocking Vietnamese error, PDF blob + all state preserved,
      one-action retry, download+maildraft fallback (002 adapter) — in ReviewSend.tsx
- [ ] T030 [US3] Reset flow: one obvious action from everywhere, warns on prepared-but-unsent
      document, clears all PII to blank state — in Summit.tsx
- [ ] T031 [US3] Academic audit listing: list-sent-roadmaps action
      (assertPermission("roadmap.audit"), Paginated, filters, signed short-lived PDF URLs) in
      src/app/actions/roadmap/list-sent-roadmaps.ts + integration coverage in
      tests/integration/summit-send.test.ts

**Checkpoint**: The presentation becomes the document; sends are archived and auditable.

---

## Phase 6: User Story 4 - Proof at the Summit (Priority: P4)

**Goal**: Consent-gated, journey-matched real-student proof at the summit; unconsented material
structurally unrenderable.

**Independent Test**: With consented + unconsented records loaded: unconsented can never render
by any path (type-level proof); a 4.5→7.0 record surfaces first for that climb; no exact match →
nearest with honest framing (quickstart Scenario 5.3).

### Tests for User Story 4 (write first — MUST fail before T034)

- [ ] T032 [P] [US4] Proof content module with consent brand: raw entries internal, the ONLY
      renderable export is CONSENTED_PROOF (branded ConsentedProof[]), placeholder consented
      AND unconsented entries — in src/lib/domain/ielts/proof.ts
- [ ] T033 [P] [US4] Proof tests: matchProof ranks by |startΔ|+|resultΔ| with editorial
      tie-break, exact before nearest, nearest never labelled exact; type-level assertion that
      unconsented data cannot reach proof components (Principle IX) — in
      tests/unit/ielts/proof.test.ts
- [ ] T034 [US4] Implement pure matchProof in src/services/ielts/proof-match.ts — T033 green
- [ ] T035 [US4] Summit proof surface (arrival treatment as state style, matched proof first,
      nearest-match framing from summit-copy.ts, photos/names/scores only from ConsentedProof)
      in src/app/(app)/lo-trinh-ielts/ProofSummit.tsx

**Checkpoint**: The summit earns its proof; consent is compile-time enforced.

---

## Phase 7: User Story 5 - Secondary Content in One Action (Priority: P5)

**Goal**: Ecosystem / commitments / FAQ each one action away and one action back; thresholds
verbatim; FAQ answers reachable without scanning a list.

**Independent Test**: From any presentation state each area opens in one action and returns in
one; commitments show both thresholds exactly; objection chip → answer in one action
(quickstart Scenario 5).

### Tests for User Story 5 (write first — MUST fail before T038)

- [ ] T036 [P] [US5] FAQ content module (objectionKey, chipLabelVi, questionVi, answerVi,
      priority; ≤ ~8 visible chips, editorial order) in src/lib/domain/ielts/faq.ts
- [ ] T037 [P] [US5] Secondary-content tests: commitments component renders both thresholds
      verbatim from thresholds.ts and contains NO threshold text of its own (SC-005), FAQ chip
      → answer is one action and back restores prior state, rail reachable from every
      presentation state — in tests/unit/ielts/secondary-content.test.tsx
- [ ] T038 [US5] Secondary content surface (persistent rail; ecosystem view from ecosystem.ts;
      commitments view importing thresholds.ts only; FAQ chips) in
      src/app/(app)/lo-trinh-ielts/SecondaryContent.tsx + rail wiring in Summit.tsx

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Minimal service worker precaching the summit shell, JS/CSS, fonts, brand assets
      for cold-start offline (research D-OFFLINE) in public/sw.js + registration in
      src/app/(app)/lo-trinh-ielts/page.tsx
- [ ] T040 [P] Guard tests: "Olympia" appears nowhere in src/ or content data (Principle VIII);
      no inline Vietnamese user-facing strings in summit components (Principle VII spot-grep) —
      in tests/unit/ielts/constitution-guards.test.ts
- [ ] T041 Diacritics & brand pass: full Vietnamese diacritics at every used weight/size on
      screen and in PDF (Montserrat VN subset; Sansita only as the tagline lockup asset —
      research D-FONT); verify src/lib/ielts/pdf/fonts.ts embeds match screen fonts
- [ ] T042 Offline validation: quickstart Scenario 3 full walk (session offline + cold start via
      SW; send failure preserves work; retry without re-entry)
- [ ] T043 Coverage gate ≥ 80% (npm run test:cov) + full quickstart Scenarios 1–7 pass +
      content-edit test (price/FAQ/narrative changes touch only lib/domain/ielts/)
- [ ] T044 Code review + security review of the send/archive surface (permission gate, RLS,
      signed URLs, env validation, no PII in logs) per house review workflow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately; T001–T003 all parallel
- **Foundational (Phase 2)**: T004 blocks T005/T006 only insofar as types are imported; T005,
  T006 parallel after T004 — **blocks all stories**
- **User Stories (Phases 3–7)**: all depend on Phase 2. US1 is the spine: US2 evolves US1
  components; US3 consumes US1+US2 output (the SummitRoadmap + Placement); US4/US5 plug into
  the US1 shell but are independently testable
- **Polish (Phase 8)**: after desired stories complete (T039/T040 can start any time after
  Phase 3)

### Story completion order

```text
Setup → Foundational → US1 (MVP) → US2 → US3 → US4 → US5 → Polish
                          └── US4 and US5 may run in parallel with US3 after US1/US2
```

### Within Each User Story

- Test tasks first; confirm RED before the implementation task; engine/model → service → UI.

## Parallel Example: User Story 1

```text
# After Phase 2, launch together (different files, no interdependencies):
T007 tests/unit/ielts/summit-engine.test.ts
T008 tests/unit/ielts/summit-pricing.test.ts
T009 tests/unit/ielts/summit-timeline.test.ts
# After T010 (engine green), launch together:
T012 Mountain.tsx | T013 StagePanel.tsx | T014 SummarySurface.tsx
```

## Implementation Strategy

**MVP first**: Phases 1–3 only (T001–T016) deliver a demonstrable offline presentation — the
product's reason to exist. Stop, run quickstart Scenario 1, demo to a consultant.

**Incremental delivery**: +US2 (provisional integrity) → +US3 (send/archive — first
network-touching code) → +US4 (proof) → +US5 (secondary) → Polish. Each checkpoint is
independently testable; no story breaks a prior one.

## Notes

- Constitution v2.0.0 gates apply throughout: bottom-to-top always (I), engine cannot skip
  (II), Placement union everywhere (III), thresholds only from thresholds.ts (IV), no network
  on the presentation path (V), no autoplay/speech-gating motion (VI), copy only from content
  modules (VII), Jaxtina identity only (VIII), ConsentedProof only (IX).
- Commit after each task or logical group (conventional commits); verify RED before GREEN.
