# Implementation Plan: IELTS Roadmap Builder

**Branch**: `002-ielts-roadmap-builder` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-ielts-roadmap-builder/spec.md`

**Status**: Design artifact (review gate 2 of 3). Companion artifacts: [research.md](./research.md)
(decision log), [data-model.md](./data-model.md) (models + engine pseudocode),
[contracts/](./contracts/) (deliveryAdapter, engine, RLS, actions).

## Summary

A consultant-facing page in the existing jax-sales app that turns a `RoadmapRequest` (current +
target band, audience, student/consultant details, intensity) into a ladder-consistent `Roadmap` via
a **pure, exhaustively-tested engine**, renders it for review/edit, produces an on-brand Vietnamese
PDF, delivers it through a swappable `deliveryAdapter`, and logs every roadmap to a centre-scoped
`RoadmapRecord` (with an audit-log entry). The load-bearing correctness lives in the engine — the
no-skipping rule, audience overrides, Intensive auto-append, and timeline maths — a pure function of
`(RoadmapRequest + course-ladder content)`, built and tested before any UI.

**Technical approach**: the engine and the content store (course ladder + narrative copy + reference
roadmaps + thresholds + brand tokens) are pure TypeScript modules with **no** DB/UI/network coupling.
The PDF is rendered with **`@react-pdf/renderer`** (client-side by default, so generation + preview +
download work offline and behind flaky centre connectivity), with **embedded Vietnamese-covering
fonts** and a structural rule that all diacritic-bearing text uses a font with verified Vietnamese
coverage. Delivery goes through a single `DeliveryAdapter` interface whose default implementation
downloads the PDF and opens a pre-filled Vietnamese `mailto:` draft; a server-email adapter drops in
later without touching the engine or UI. Submission logs a `RoadmapRecord` through the canonical
mutation pipeline (`withError → assertPermission → schema.parse → service`) with centre-narrow-write
RLS and a general audit-log entry. The internal-only deadline warning lives on the `Roadmap` type in
a field that is **never** passed into the PDF document component — a structural, type-enforced barrier.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16 App Router, React 19 (same app as slice #001).

**Primary Dependencies**: `@react-pdf/renderer` (PDF), `zod` (boundary validation),
`@tanstack/react-query` (server-state), `@supabase/ssr` + `@supabase/supabase-js`, and the slice-#001
foundation modules (`vocabulary.ts`, `permissions.ts`, `assert-permission.ts`, `server-action.ts`,
`case.ts`, `pagination.ts`).

**Storage**: Supabase Postgres. One new tenant table `roadmap_records` (RLS: broad read,
centre-narrow write). The generated PDF binary is NOT stored in this slice (only roadmap metadata is
logged); PDF storage in Supabase Storage is a documented future enhancement.

**Testing**: Vitest. The engine is unit-tested exhaustively (pure, no DB). Persistence/permission
boundaries are integration-tested against the **live local Supabase stack, sequentially, no mocking**
(constitution Principle IV) — a permission-rejection test (teacher denied) and a centre-isolation
test for `roadmap_records`.

**Target Platform**: Web (server + client components); centre laptops, evergreen browsers.

**Project Type**: Web application (single Next.js app; new page + engine + content + adapter).

**Performance Goals**: Blank-form → deliverable PDF < 3 min (SC-001). Engine is O(ladder length).
Client-side PDF render of a ~6–8-course document is sub-second. CWV budget from #001.

**Constraints**: No-skipping enforced in the engine + exhaustively tested (SC-002). Two commitment
thresholds never merged (SC-007). Deadline warning structurally impossible in the PDF (SC-006). All
copy Vietnamese; narrative content is data, editable without touching logic (FR-CONTENT-01).
Diacritics render 100% (SC-004). Files < 800 lines, functions < 50, nesting ≤ 4. ≥ 80% coverage.

**Scale/Scope**: Mid-size chain (from #001). Roadmap volume is low (one per consultation);
`roadmap_records` grows at leads-conversion rate — well within the indexed pagination model.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

| Principle | Gate | Status |
|---|---|---|
| **I. Vietnamese-First** | All labels Vietnamese via the one vocabulary source; enum ids never rendered; narrative copy in an editable content store. | ✅ PASS — FR-CONTENT-01/02, SC-010; band/audience/intensity/purpose labels added to `vocabulary.ts`. |
| **II. Layered Security & Multi-Tenant Isolation (NON-NEGOTIABLE)** | Route guard + `assertPermission("roadmap.generate")` + RLS on `roadmap_records`; reads broad, writes centre-narrow. | ✅ PASS — FR-ACCESS-01/02, FR-LOG-02, SC-008; new key in the registry, one nav-matrix entry. |
| **III. Canonical Mutation Pipeline** | Submit/log flows `withError → assertPermission → schema.parse → service`; audit on the sensitive write; friendly Vietnamese errors. | ✅ PASS — FR-ACCESS-02, FR-LOG-01/02. |
| **IV. Test-First with Isolation Proof (NON-NEGOTIABLE)** | TDD ≥80%; engine exhaustively tested (no-skip invariant); permission-rejection + centre-isolation for `roadmap_records` vs real DB, no mocks. | ✅ PASS — SC-002/008/009; engine tests land before UI. |
| **V. Atomicity, Idempotency & Immutability** | Engine pure/immutable; the log write is simple-CRUD-plus-audit (accepted two-call §6 trade-off — only risk is a missing log row, never corrupt data). | ✅ PASS — a stable idempotency key per request prevents duplicate logs on double-submit. |

**Engineering standards**: nav-is-access-matrix (one entry), camelCase↔snake_case boundary,
pagination on the records list, single data seam, size limits, explicit Vietnamese errors — all
honored. Narrative content is split per course-family into separate files to respect the 800-line
limit and keep academic edits localized. ✅ PASS.

**Initial gate result: PASS.** No violations; Complexity Tracking not required.

**Post-Design re-check (after Phase 1): PASS.** Each principle traces to an artifact — engine
contract + pseudocode ([data-model.md](./data-model.md), [contracts/engine.md](./contracts/engine.md));
RLS clauses ([contracts/rls-policies.md](./contracts/rls-policies.md)); the deliveryAdapter seam
([contracts/delivery-adapter.md](./contracts/delivery-adapter.md)); the decision log
([research.md](./research.md)). The internal-only deadline warning is enforced by TYPE structure (the
PDF document type has no field for it) — see data-model.md. No new violations.

## Architecture & Module Boundaries

Strict separation so the ladder rules (the part that must not be wrong) are isolated and pure:

```
CONTENT DATA (pure, academic-team-editable — no logic)
  src/lib/domain/ielts/
    courses.ts            # the ordered ladder: Course[] (codes, bands, sessions, flags)
    bands.ts              # ordered band scale + bandValue() index helper
    narrative/            # per-course-family narrative copy (split for 800-line limit)
      booster-achiever.ts # 4-block shape for B1..A3
      foundation.ts       # Foundation shape for IF1/IF2
      intensive.ts        # Intensive shape for INT
      pre-s-gp.ts         # Pre-S / Grammar Pathway (provisional)
    reference-roadmaps.ts # the 6 audience baselines (validation fixtures)
    thresholds.ts         # the two commitment thresholds (verbatim, distinct)
    ecosystem.ts          # Hệ sinh thái hỗ trợ list
    brand.ts              # brand token table (colors, fonts, footer, asset paths)

ENGINE (pure ⚙ — no DB/UI/network; exhaustively tested)
  src/services/ielts/roadmap-engine.ts   # (RoadmapRequest + ladder) -> Roadmap

DELIVERY ADAPTER (swappable seam)
  src/services/ielts/delivery/
    adapter.ts            # DeliveryAdapter interface + DeliveryResult
    download-maildraft.ts # default: download PDF + open pre-filled mailto draft
    (server-email.ts)     # future: server-side email adapter (same interface)

PERSISTENCE / PIPELINE
  supabase/migrations/*_roadmap_records.sql   # table + RLS + indexes
  src/schemas/roadmap.ts                      # Zod: RoadmapRequest
  src/services/ielts/roadmap.service.ts       # logRoadmapRecordCore, listRoadmapRecordsCore
  src/app/actions/roadmap/                     # submitRoadmap, listRoadmapRecords (canonical pipeline)

PDF
  src/lib/ielts/pdf/
    fonts.ts              # Font.register (embedded Vietnamese-covering fonts)
    RoadmapDocument.tsx   # @react-pdf document; 6 sections in order
    sections/*            # Cover, Timeline, CourseCards, Commitments, Ecosystem, Contact

UI (page)
  src/app/(app)/lo-trinh-ielts/
    page.tsx              # server: resolve claims, gate, load content + centres
    RoadmapForm.tsx       # client: the input form (US1)
    RoadmapReview.tsx     # client: review/edit, identical to PDF layout (US5)
```

**Data flow**: form (client) → `roadmap-engine` (client, pure) → `Roadmap` → `RoadmapReview` (edit)
→ on approve: render PDF (client) + call `submitRoadmap` server action (logs `RoadmapRecord` +
audit) + invoke `deliveryAdapter`. The engine and content run client-side so generate/preview/
download work offline; only the audited submit needs connectivity.

## PDF Generation Approach (decision + justification)

**Chosen: `@react-pdf/renderer`, rendered client-side by default.** Full reasoning and rejected
alternatives are in [research.md](./research.md) (decision D-PDF). Why it uniquely fits:

- **Vietnamese diacritics (hard criterion SC-004)**: `@react-pdf` embeds TTF fonts via
  `Font.register`. The guarantee is made **structural**: all diacritic-bearing Vietnamese text uses a
  font with verified full Vietnamese coverage (Montserrat covers Latin Extended / Vietnamese);
  Sansita (display) is used **only** for brand strings verified ASCII/covered (e.g. "Jaxtina – IELTS
  Made SIMPLE"). A missing glyph becomes impossible by construction, not by luck.
- **Offline + download-default + <3 min**: runs in the browser, so generate → preview → download
  works with no server round-trip (fits the deferred-email default and flaky centre wifi).
- **No headless browser**: avoids Puppeteer/Chromium's serverless weight and cold starts; the same
  renderer can later run server-side for the email adapter, so the investment is reused.
- **React layout**: the document (cover, timeline strip, cards, sections) maps cleanly to
  `@react-pdf`'s flexbox subset; brand tokens come from `brand.ts`.

**Offline capability (decision)**: generation, preview, and PDF download are **fully client-side and
work offline**. The audited **submit** (writing `RoadmapRecord` + audit) **requires connectivity** —
audit logging is a hard requirement (FR-LOG-01) and must not be silently skipped. IF offline at
submit time THEN the UI SHALL let the consultant download/deliver the PDF but SHALL clearly report
that logging is pending and withhold the "sent" confirmation until the record is written. (A durable
offline log-queue is a future enhancement, not this slice.)

## Brand Token Table (from the brief; lives in `brand.ts`)

| Token | Value |
|---|---|
| `color.navy` | `#2B3A8C` |
| `color.red` | `#D01F26` |
| `font.body` (diacritic-bearing) | Montserrat (verified Vietnamese coverage) |
| `font.display` (ASCII-safe brand strings only) | Sansita |
| `footer.text` | `Jaxtina – IELTS Made SIMPLE` (red footer bar) |
| `asset.logo` | Jaxtina logo (embedded) |
| `asset.mascot` | Jaxtina mascot (embedded) |

## Error Handling

- **Input**: Zod at the boundary (`schemas/roadmap.ts`); friendly Vietnamese messages (FR-INPUT-02).
  Target ≤ current, bad email, missing required → blocked pre-generation.
- **Engine**: pure; returns a well-formed `Roadmap` for every valid request. Edge inputs (entry above
  ladder top, target 8.0+) return a defined shape with a consultant-only note — never an empty or
  gapped sequence, never a throw for a validated request.
- **Submit/log**: through `withError` → discriminated `{data}|{error}`; an audit-log write failure is
  logged server-side and does not corrupt the record (accepted §6 trade-off).
- **Delivery**: the adapter returns `DeliveryResult` (`delivered | drafted | failed`); a `failed`
  result surfaces a Vietnamese message and leaves `RoadmapRecord.sent = false`.
- **Offline submit**: explicit "logging pending" state; never a silent success.

## Testing Strategy

Ordered so the engine and its suite land before any UI (the ladder rules must not be wrong):

1. **Engine unit tests (exhaustive, pure)** — for every entry/target pair: assert the contiguous
   slice, correct endpoints, and **no gap** (SC-002/AC-2.4); audience overrides (Mất gốc→PRE_S,
   THCS→GP-before-B1); INT auto-append; timeline maths; the six reference-audience duration-range
   checks (SC-003); edge cases (target<current, target=current, entry-above-top, target 8.0+, missing
   exam date, GP provisional). A type-level test asserts the PDF document input cannot carry the
   deadline warning (SC-006).
2. **Threshold-fidelity test** — the commitments section renders both thresholds distinctly and
   verbatim; asserts they are never merged (SC-007).
3. **Persistence/permission integration tests (live DB, no mocks)** — permission-rejection (a
   `teacher` denied `roadmap.generate`, SC-008); centre-isolation for `roadmap_records` (incl. a raw
   INSERT RLS-bypass probe); log completeness (every submit writes a record + audit entry).
4. **Diacritic/brand smoke test** — render a sample PDF; assert Vietnamese text + brand tokens
   present; visual fidelity confirmed in quickstart.
5. **Coverage** ≥ 80% for engine + tenancy/permission boundaries (SC-009).

## Project Structure

### Documentation (this feature)

```text
specs/002-ielts-roadmap-builder/
├── plan.md            # this file
├── research.md        # decision log (all open decisions resolved with reasoning)
├── data-model.md      # data models + engine pseudocode
├── contracts/
│   ├── engine.md              # roadmap-engine function contract
│   ├── delivery-adapter.md    # DeliveryAdapter interface
│   ├── roadmap.actions.md     # submit/list server-action contracts
│   └── rls-policies.md        # roadmap_records RLS
├── quickstart.md      # validation scenarios
├── checklists/requirements.md
└── tasks.md           # NEXT (/speckit-tasks — not created here)
```

### Source Code — see Architecture & Module Boundaries above (single Next.js app at repo root).

**Structure Decision**: reuse the slice-#001 app structure. The engine (`src/services/ielts/`) and
content (`src/lib/domain/ielts/`) are new pure modules; the page lives under the existing `(app)`
shell; persistence adds one migration + one service + actions following the established canonical
pipeline and RLS patterns. No new top-level project.

## Complexity Tracking

No constitution violations — intentionally empty.
