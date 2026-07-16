# Quickstart & Validation: IELTS Roadmap Builder

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md)

References [data-model.md](./data-model.md) and [contracts/](./contracts/) rather than restating
them. Implementation belongs to tasks.md — this is a run & verify guide.

## Prerequisites

- The slice-#001 app running (Next.js dev server + local Supabase stack, ports 5442x).
- `@react-pdf/renderer` added; embedded fonts (Montserrat + Sansita) placed in the fonts dir.
- `roadmap_records` migration applied (`supabase db reset`).

## Verification commands

```bash
npm run test          # engine (exhaustive) + persistence/permission integration
npm run test:cov      # coverage ≥ 80% (SC-009)
npm run typecheck     # includes the type-level internal-warning barrier check
npm run lint
npm run dev           # exercise the page at /lo-trinh-ielts
```

---

## Scenario 1 — Blank form → deliverable PDF < 3 min (US1, US6, SC-001)

1. Sign in as a seeded `sale_consultant`; open `/lo-trinh-ielts`.
2. Fill: student name/email, audience "Người đi làm", current `2.5`, target `6.0`, purpose, intensity
   "Tiêu chuẩn", consultant fields → generate.
3. Review screen shows the roadmap; approve → PDF downloads + Vietnamese mail draft opens.
   **Expected**: end-to-end under 3 minutes; PDF is on-brand, no manual editing needed.

## Scenario 2 — No level skipping (US2, SC-002)

Engine tests assert, for **every** entry/target pair, the sequence is the contiguous ladder slice
with correct endpoints and no gap. Manual spot-check: current `2.5`, target `5.5` → `IF2 → B1 → B2`
(no jump from IF2 to B2). **Expected**: exhaustive test suite green.

## Scenario 3 — Audience overrides + Intensive append + duration ranges (US3, SC-003)

- "Mất gốc", current `~A1`, target `6.0` → sequence starts `PRE_S`; total months within 18–24.
- "THCS" → `GP` inserted before `B1`.
- target ≥ 5.5 with an exam date → `INT` appended.
**Expected**: each of the six reference audiences lands within its stated duration range (or a
documented divergence).

## Scenario 4 — Deadline warning is internal-only (US4, SC-006)

Generate with a target exam date earlier than projected completion → the consultant view shows an
amber warning. Render the PDF → it contains no trace of it. **Expected**: the type-level test proves
the PDF input type cannot carry the warning (compile-time), plus a render assertion.

## Scenario 5 — Review & edit flags a manual override (US5, AC-5.4/5.5)

Remove a course on the review screen → a non-blocking "departs from standard ladder" warning; submit
→ the `roadmap_records` row has `manual_edited = true`. **Expected**: flag persisted.

## Scenario 6 — Both commitment thresholds distinct (US6, SC-007)

Inspect the PDF "Cam kết đầu ra & điều kiện" section → the completion certificate (≥ output band,
attendance ≥ 90%, homework ≥ 90%) and the written output guarantee (homework ≥ 95%, ≤ 1 absence)
appear **separately and verbatim**. **Expected**: threshold-fidelity test green; never merged.

## Scenario 7 — Access control + logging (US1, US7, SC-005/008)

- Sign in as `teacher` → `/lo-trinh-ielts` denied; `submitRoadmap` refused, nothing written.
- As a consultant, every generate+submit writes a `roadmap_records` row (+ audit entry) confined to
  their centre; a centre-A user cannot read/write centre-B records (incl. raw-insert RLS probe).
**Expected**: permission-rejection + centre-isolation tests green.

## Scenario 8 — Diacritics + brand fidelity (US6, SC-004)

Render a PDF with diacritic-heavy Vietnamese (e.g. "Lộ trình học IELTS được cá nhân hoá") → all
diacritics render correctly; navy/red palette, footer bar, logo, mascot present. **Expected**:
diacritic/brand smoke test green; visual confirmation.

## Done / pass criteria

- Engine suite green (exhaustive no-skip); ≥ 80% coverage (SC-009).
- Security-proof (permission-rejection + centre-isolation, live DB, no mocks) green (SC-008).
- Both thresholds distinct (SC-007); deadline warning absent from PDFs (SC-006); diacritics 100%
  (SC-004); every roadmap logged (SC-005).
