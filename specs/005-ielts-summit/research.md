# Phase 0 Research: Jaxtina IELTS Summit

All Technical Context unknowns resolved. Each decision records rationale and alternatives.

## D-REUSE — Build on feature 002, don't fork it

**Decision**: The Summit reuses 002's pure engine (`roadmap-engine.ts`), band scale, ladder,
narrative, thresholds, ecosystem, brand tokens, client-side PDF pipeline, and the
`DeliveryAdapter` seam. The `lo-trinh-ielts` route evolves in place into the Summit.

**Rationale**: 002 already implements and exhaustively tests the crown-jewel invariant
(contiguous slice, no skipping — Constitution II) and proved the structural-barrier pattern
(`StudentRoadmapView` makes leaking internal fields a compile error) that Principles III and IX
require. Duplicating any of it would create a second source of truth for the ladder.

**Alternatives considered**: (a) Greenfield summit module alongside 002 — rejected: two engines
over one ladder guarantees drift; (b) rewrite 002 to the summit spec — rejected: 002's
audience/intensity/exam-date capabilities remain valid product surface; the summit narrows the
*entry point*, not the engine.

## D-ENGINE — Narrowed SummitRequest; FR-003 append rule at the summit boundary

**Decision**: New pure `summit-engine.ts` exposes
`generateSummitRoadmap(req: SummitRequest): SummitRoadmap` where `SummitRequest` is exactly
{studentName, currentBand, targetBand, placement}. It delegates slicing to the shared engine
with fixed defaults (standard intensity, no audience, no exam date) and applies the Intensive
append per spec FR-003: append INT iff target ≥ 5.5 AND (target − final rung output) ≤ 0.5
band. 002's exam-date-driven append and A3-inclusion policy are not used on the summit path
(they key off inputs the summit doesn't collect).

**Rationale**: Spec FR-030 fixes the opening to three inputs + mode. Divergent append policies
must live at the boundary that owns the inputs, keeping the shared slice logic single-source.
Under FR-003, any target ≥ 5.5 whose slice meets it exactly gets INT (gap 0 ≤ 0.5) — that is
the spec's stated rule, encoded as data-driven constants, not conditionals sprinkled in UI.

**Alternatives considered**: Modify 002's engine flags in place — rejected: would silently
change 002's tested behaviour; wrap instead.

## D-PRES — Pre-S has no promised duration on the summit

**Decision**: On the summit path Pre-S renders as the mountain's base (only when entry is
"below A1") with sessions shown as "linh hoạt" (flexible) and excluded from the precise totals;
the summary carries an explicit note when Pre-S is in the climb. `courses.ts` keeps its
internal estimate for 002 use; the summit view maps PRE_S duration to `null`.

**Rationale**: Spec FR-001 lists Pre-S with no fixed buổi ("—"); the edge-case section demands
explicit handling, and a false-precision total would violate FR-004's "range, never false
precision".

**Alternatives considered**: Show the 16-session estimate — rejected: presents an unpromised
number in a document families keep.

## D-MODE — Placement as a discriminated union, enforced in the renderer's input type

**Decision**: `placement: { kind: "measured"; testDate: string } | { kind: "estimated" }` lives
on the consultation object. Screen components and the PDF document take the union; the cover
component's estimated branch *is* the caveat rendering — there is no boolean prop a caller
could forget. Switching Mode B → A requires entering a placement result (kind change), which
re-renders everything at once.

**Rationale**: Constitution III demands it be structurally impossible to produce a
confirmed-looking provisional artifact. A union the renderer must exhaustively switch on (TS
`never` check) is the same compile-time barrier 002 used for `StudentRoadmapView`.

**Alternatives considered**: `isProvisional: boolean` styling flag — rejected: forgettable at
call sites; runtime watermarking — rejected: weaker than type-level, testable only by sampling.

## D-PRICE — Per-centre price lists as content data; totals are arithmetic

**Decision**: `pricing.ts` content module: `PRICES: Record<CentreKey, Partial<Record<CourseCode,
number>>>` (VND). The summit engine sums the illuminated stages' prices from the consultation's
centre list. A course missing a price (e.g. PRE_S) displays "liên hệ tư vấn" and is excluded
from the total with an explicit marker. No discounts, bundles, or schedules (clarified
2026-07-17).

**Rationale**: FR-015/016 + Principle VII: marketing edits numbers in one data file; totals stay
honest arithmetic; per-centre structure costs nothing now and avoids a migration later.

**Alternatives considered**: Prices in DB — rejected: puts the presentation path on the network
(Constitution V); single flat list — rejected: spec explicitly requires per-centre structure.

## D-PROOF — Consent brand at the module boundary

**Decision**: `proof.ts` holds raw entries including `consent: { written: true; onFileRef:
string } | { written: false }`. The module's only export of renderable material is
`CONSENTED_PROOF: readonly ConsentedProof[]`, where `ConsentedProof` is a branded type produced
by an internal narrowing function that filters on `consent.written === true`. Components and
the PDF import only `ConsentedProof`; nothing else is exported. `proof-match.ts` ranks
consented records by journey distance |startΔ| + |resultΔ| to the presented climb, with a
labelled generic fallback (never claiming an exact match).

**Rationale**: Constitution IX — unconsented material must be structurally unrenderable. The
brand makes "render an unconsented record" untypeable outside the module; matching relevance is
spec Story 4.

**Alternatives considered**: Filter in components — rejected: convention, not structure; DB
table with RLS — rejected: network on the presentation path.

## D-OFFLINE — Bundle everything; minimal service worker for cold start

**Decision**: All presentation content is compiled into the client bundle (already the 002
pattern); the engine and PDF run client-side, so a loaded app needs zero network. Add a
minimal hand-written `public/sw.js` that precaches the summit route shell, JS/CSS, fonts, and
brand assets so a cold start with no connectivity still opens the tool. Auth session is
established while online (start of day); the summit route renders with the cached session and
never blocks on a fetch.

**Rationale**: Constitution V says no network on the path from *opening the tool* to showing
the climb. Session-offline is free with bundled data; cold-start-offline needs the SW.

**Alternatives considered**: `next-pwa`/Serwist dependency — rejected for v1: a full PWA
toolchain for one precache list violates KISS; "app already open" assumption without SW —
rejected: fails the principle's plain reading; Electron shell — rejected: massive scope change.

## D-DELIVERY — Real email behind the existing adapter seam

**Decision**: New `email-send.ts` delivery adapter posts the client-generated PDF to the
`send-summit-roadmap` server action, which emails it via a provider configured by validated
env vars (Resend as default provider; SMTP interchangeable behind the same action). The 002
download+mail-draft adapter is retained as an explicit consultant-facing fallback when send
fails, satisfying "fail loudly and preserve the work": on failure the UI shows a blocking
Vietnamese error, keeps the PDF blob and all state, and offers retry + download.

**Rationale**: Spec Story 3 requires the PDF to *reach the student by email*; the adapter seam
(002 contract) exists precisely so the mechanism can change without touching engine or UI.

**Alternatives considered**: Client-side mailto with attachment — impossible (mailto carries no
attachments); Supabase Edge Function email — viable but adds a second deployment surface;
provider SDK on the client — rejected: leaks API keys.

## D-ARCHIVE — Archive rides the send action; Storage + metadata row

**Decision**: The same `send-summit-roadmap` action (a) uploads the exact PDF bytes to a
private Supabase Storage bucket `roadmap-archive/<centre>/<id>.pdf` and (b) inserts a
`summit_sends` row (consultant, centre, date, placement kind, bands, total price,
ladder-edited flag, pdf path, delivery status). RLS: INSERT confined to the caller's centre;
SELECT for academic-audit permission holders network-wide. If archive or email fails, the whole
send reports failure loudly; the prepared work stays client-side for retry (idempotent via a
generation key, the 002 pattern).

**Rationale**: Clarified 2026-07-17: full PDF + metadata, reviewable by the academic team. One
action keeps "send" atomic from the consultant's view and adds no network to presentation.

**Alternatives considered**: Metadata only — rejected by user; separate archive step —
rejected: two failure surfaces where the consultant needs one.

## D-MOUNTAIN — Layered SVG/CSS scene, compositor-only motion

**Decision**: The mountain is a layered SVG/CSS composition (sky/atmosphere layers, path, stage
markers bottom-to-top) sized to the laptop viewport without scrolling for the default view.
Illumination, recede/dim, stage expand, and the summit "arrival" treatment animate only
`transform`, `opacity`, and `filter`-lite effects, ≤ 300ms, interruptible, honouring
`prefers-reduced-motion`. Exactly one stage expands at a time (accordion semantics); every
state (any stage, summary, secondary content, review) is one action from any other via a fixed
always-visible control rail.

**Rationale**: Constitution I (bottom-to-top, metaphor), VI (nothing gates speech), Engineering
performance constraints; SVG keeps the scene resolution-independent and theme-consistent with
the PDF's timeline rendering.

**Alternatives considered**: Canvas/WebGL scene — rejected: heavy, hurts INP and PDF parity;
scroll-driven storytelling — rejected: forces linearity (spec demands no wizards) and gates
speech on scroll position.

## D-FONT — Montserrat VN subset everywhere; Sansita only in the tagline lockup

**Decision**: Montserrat with the Vietnamese subset (already embedded for the 002 PDF via
`fonts.ts`) is the sole text face on screen and in the PDF. Sansita appears only in the tagline
lockup "Jaxtina – IELTS Made SIMPLE" — an all-ASCII string — shipped as a pre-rendered brand
asset (SVG) so no Vietnamese glyph ever renders in Sansita. Diacritic rendering at every used
weight/size is asserted in the quickstart validation checklist (FR-029).

**Rationale**: Removes the risk that Sansita's Vietnamese coverage becomes a silent defect; the
tagline contains no diacritics, so a lockup asset loses nothing.

**Alternatives considered**: Embedding Sansita VN subset — unnecessary surface; system font
fallbacks — rejected: brand + PDF/screen parity.

## D-FAQ — Objection-keyed one-action retrieval

**Decision**: `faq.ts` entries carry `objectionKey`, a short consultant-facing chip label, the
parent-facing question, and the answer. The FAQ surface renders the chips directly (no list to
scroll, no search box); one click opens the answer; one click returns. Grouping tops out at ~8
visible chips ordered by editorial priority (content data controls order).

**Rationale**: Spec Story 5: "reach the right answer in one action". Chips-as-index is the
minimal interaction meeting that bar without building search.

**Alternatives considered**: Searchable list — two actions minimum (type, pick) and typing in
front of a parent; accordion list — scanning is the failure mode the spec names.

## D-SCOPE — Confirmed exclusions

**Decision**: Learner profiles (six personas), Grammar Pathway, audience/intensity/exam-date
inputs, promotions/instalments, non-email delivery, phone/parent/student surfaces, and any
consultation history UI beyond the academic audit listing are all out of scope for 005.

**Rationale**: Clarifications of 2026-07-17 + constitution scope boundary; 002 retains its own
surface for the richer request shape.
