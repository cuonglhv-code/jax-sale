# Phase 0 Research & Decision Log: IELTS Roadmap Builder

**Date**: 2026-07-16 | **Plan**: [plan.md](./plan.md)

Every open decision the brief flagged is resolved here with reasoning and rejected alternatives.
Domain decisions that require academic-team sign-off are marked **⚠ CONFIRM** — the engine is built
against the recommended default so everything is testable now, and the default is isolated in the
content store so a change is data-only.

---

## D-A3 — Achiever 3 policy (BLOCKING; affects engine output at target = 6.5) ⚠ CONFIRM

**Decision**: **Option (i)** — A3 is an **included-but-removable** rung, auto-inserted when
`target ≥ 6.5`.

**Reasoning**:
- Pure ladder slicing already selects A3 whenever `target > 6.5` (A2 outputs 6.5; to exceed 6.5 you
  need A3, output 7.0). The only genuine ambiguity is at **exactly 6.5**, where A2's output already
  meets the target.
- The reference paths write A3 in parentheses — "…A2 → (A3)" for THCS/THPT — signalling *included
  but optional*, which is precisely option (i): auto-included, consultant may remove (removal is a
  logged manual override per AC-5.4). Option (ii) ("standard/mandatory for ≥ 6.5") contradicts that
  parenthetical and would make a common consultant action (dropping A3 for a 6.5 target) an
  always-on override warning.
- Consistent with the no-skipping rule: including A3 never *skips*; removing it is an explicit,
  audited departure — exactly the guardrail US5 defines.

**Rejected**: (ii) A3 mandatory for `≥ 6.5` — over-includes at the 6.5 boundary, fights the deck's
parenthetical, and makes routine tailoring look like a rule violation.

**⚠ CONFIRM with academic team.** Isolated as a single flag on the `A3` course entry + one engine
branch; flipping to (ii) is a one-line content/policy change with no structural impact.

---

## D-GP — Grammar Pathway session count ⚠ CONFIRM

**Decision**: Use a **clearly-marked provisional placeholder** for GP's session count; the engine
includes GP in the sequence (THCS override) but **flags its session contribution as provisional** in
totals, and the UI/PDF surface that GP's duration is pending academic confirmation.

**Reasoning**: The count is absent from the source deck (a genuine unknown). Inventing a number would
silently corrupt timeline totals and the reference-range validation (SC-003). Marking it provisional
keeps the roadmap generatable and honest, and confines the fix to one content value.

**Rejected**: guessing a plausible number (e.g. 16/24) — would produce confidently-wrong timelines.

**⚠ CONFIRM with academic team.** Single value in `courses.ts`; setting it resolves totals with no
code change.

---

## D-INT — Intensive ("Tăng cường") rate ⚠ CONFIRM

**Decision**: Intensive rate = **4 sessions/week** (vs Standard 2.7), as the brief proposed.

**Reasoning**: A defensible upper-intensity default for timeline maths; larger than the 2.7 effective
Standard rate, reflecting the "Tăng cường" promise. Isolated as a single constant.

**Rejected**: leaving it undefined — the intensity toggle would have no effect on the timeline,
breaking AC-3.4.

**⚠ CONFIRM with academic team.** One constant in `bands.ts`/engine config.

---

## D-PDF — PDF rendering approach (guarantee Vietnamese diacritics + brand fonts)

**Decision**: **`@react-pdf/renderer`, client-side by default**, with a structural
diacritic-safety rule (diacritic-bearing text → Montserrat; Sansita only for verified ASCII/covered
brand strings).

**Reasoning** (options evaluated):

| Option | Diacritics | Brand fidelity | Offline / client-side | Ops weight | Verdict |
|---|---|---|---|---|---|
| **@react-pdf/renderer** | ✅ embedded TTF (structural rule) | ✅ good (flexbox subset) | ✅ runs in browser | ✅ pure JS | **CHOSEN** |
| Puppeteer/Playwright → print | ✅ native browser shaping | ✅✅ full CSS | ❌ server-only | ❌ Chromium, cold starts | Rejected — heavy, no offline |
| Browser `window.print()` | ✅ native | ⚠ inconsistent margins/breaks | ✅ | ✅ | Rejected — can't guarantee "no manual editing / on-brand" |
| jsPDF / pdfmake | ⚠ painful glyph/shaping setup | ⚠ manual layout | ✅ | ✅ | Rejected — weaker Vietnamese support, less React-native |

- **Diacritics are made structural, not incidental**: the render layer forbids putting
  diacritic-bearing text in any font without verified Vietnamese coverage. Montserrat covers Latin
  Extended (Vietnamese). Sansita's Vietnamese coverage is uncertain, so it is restricted to brand
  display strings known to be safe. A missing glyph is impossible by construction — this is how
  SC-004 ("100% diacritics") is *guaranteed* rather than hoped.
- **Client-side** satisfies offline generation + the download-default delivery + the <3-min flow, and
  avoids a headless-browser dependency. The identical document component can render server-side later
  for the email adapter — no rework.

**Rejected**: Puppeteer (best fidelity but server-only, heavy, defeats offline); `window.print()`
(no brand/no-edit guarantee); jsPDF (diacritic pain).

**Implementation check (not blocking design)**: confirm Sansita's exact Vietnamese glyph coverage;
if any needed brand string has diacritics, that string uses Montserrat instead — the rule already
covers this.

---

## D-OFFLINE — Offline capability

**Decision**: **Generation + preview + PDF download are fully client-side (work offline). The audited
submit (write `RoadmapRecord` + audit) requires connectivity.**

**Reasoning**: Centres have unreliable connectivity, and the engine + content + `@react-pdf` are all
client-capable, so the consultant can always reach a downloadable PDF. But audit logging is a hard
requirement (FR-LOG-01) that must never be silently skipped — so the *logged submit* needs the
network. Offline at submit time yields an explicit "logging pending" state (PDF still
downloadable/deliverable), never a silent success and never a skipped log.

**Rejected**: full offline including logging via a local queue — a durable offline-sync mechanism is
real scope creep for this slice; deferred as a future enhancement.

---

## D-DELIVERY — Default deliveryAdapter implementation

**Decision**: Default = **`DownloadMailDraftAdapter`** — renders + downloads the PDF and opens a
pre-filled Vietnamese `mailto:` draft addressed to the student; the consultant attaches the
just-downloaded PDF and sends. A future `ServerEmailAdapter` implements the same interface
server-side (renders the PDF server-side, sends via a mail provider) with **no** engine/UI change.

**Reasoning**: The brief's delivery options A (static/no-backend) vs B (Apps Script) are moot inside
the existing Next.js + Supabase app; the live decision is the adapter. `mailto:` cannot attach files,
so the default flow is download-then-attach (exactly the brief's option-A behaviour). `DeliveryResult`
distinguishes `drafted` (mail draft opened, send not confirmed) from `delivered` (future server send)
and `failed`; `RoadmapRecord.sent` reflects best-known status (a `drafted` result is not a confirmed
send). The single interface (see [contracts/delivery-adapter.md](./contracts/delivery-adapter.md)) is
the only thing the UI/engine depend on.

**Rejected**: wiring a real mail provider now — adds a vendor + credentials the project doesn't have;
deferred behind the same interface (per the approved spec's email-deferred decision).

---

## D-CONTENT — Content store mechanism (editable by academic team)

**Decision**: **TypeScript/JSON content modules** under `src/lib/domain/ielts/` (courses, per-family
narrative, reference roadmaps, thresholds, ecosystem, brand), strictly separated from engine/UI
logic. Narrative is split per course-family into separate files (800-line limit + localized edits).

**Reasoning**: Satisfies FR-CONTENT-01 (content is data, not logic; editable without touching logic)
with the least machinery for this slice. A DB-backed content table with an academic-team admin UI
(edit copy without a deploy) is a clear future enhancement but is its own feature; forcing it now
would balloon scope. The module boundary is drawn so that swapping the *source* of content (file →
DB) later touches only a loader, not the engine.

**Rejected (for now)**: DB-backed editable content store — better long-term editability, but a
separate feature (needs an admin surface); deferred.

---

## D-STACK — Stack (no research needed)

Inherited from jax-sales / slice #001: Next.js 16 + Supabase (Postgres + RLS + Auth), Zod, TanStack
Query, Vitest vs live local Supabase. No decision required.

---

## Open items carried into implementation

| Item | Status | Resolution path |
|---|---|---|
| A3 policy (i) vs (ii) | ⚠ academic confirm | one flag in `courses.ts` + one engine branch |
| GP session count | ⚠ academic confirm | one value in `courses.ts` (provisional until then) |
| Intensive rate = 4/wk | ⚠ academic confirm | one constant |
| Sansita Vietnamese coverage | implementation check | structural rule already forces Montserrat for diacritics |
| Server-email adapter | deferred | implements the existing `DeliveryAdapter` interface |
| DB-backed content store | deferred | swap the content loader only |

No blocking unknowns remain for building the engine, persistence, PDF, and default delivery. The
three ⚠ items are single data/config values isolated in the content store; none blocks the design or
the engine's structure.
