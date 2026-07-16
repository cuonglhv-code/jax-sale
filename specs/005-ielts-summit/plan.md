# Implementation Plan: Jaxtina IELTS Summit

**Branch**: `005-ielts-summit` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-ielts-summit/spec.md`

## Summary

Turn the existing roadmap builder (feature 002) into a persuasion instrument: a bottom-to-top
mountain presentation the consultant drives live (illuminated climb slice, one-stage-at-a-time
narrative, Mode A/B provisional treatment, per-stage + total price, consent-gated proof at the
summit), which then produces the branded PDF from the same single source and emails it to the
student, archiving the exact sent PDF for academic-team audit.

Technical approach: reuse 002's pure roadmap engine, domain content modules, client-side PDF
(`@react-pdf/renderer`), and delivery-adapter seam. Add a narrowed `SummitRequest` (name +
current band + target band + mode), a Mode A/B discriminated union enforced through the renderer
(the `StudentRoadmapView` structural-barrier pattern already proven in 002), per-centre price
content data, consent-branded proof content data, a new mountain presentation UI at
`lo-trinh-ielts`, a real email delivery adapter behind the existing seam, and a send archive
(Supabase Storage + record row). All presentation content stays in the client bundle so the
presentation path never touches the network; a minimal service worker covers cold-start offline.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24 runtime for server actions

**Primary Dependencies**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4,
`@react-pdf/renderer` 4 (client-side PDF), TanStack Query 5, Zod 4, `@supabase/ssr` +
`supabase-js` (auth, Postgres, Storage), dnd-kit (review reorder)

**Storage**: Supabase Postgres (send archive metadata, RLS-enforced) + Supabase Storage (sent
PDF archive). ALL presentation content (ladder, narrative, pricing, proof, FAQ, thresholds,
ecosystem, brand) is bundled content data under `src/lib/domain/ielts/` — no DB on the
presentation path.

**Testing**: Vitest (unit: engine, pricing, mode gating, consent gating — exhaustive band-pair
tests); integration tests against local Supabase (archive RLS); offline validation scenario in
quickstart.md

**Target Platform**: Laptop browsers (Chrome/Edge current) in centres with unreliable
connectivity; screen turned toward a student and parent across a desk

**Project Type**: Existing single Next.js web application (extends feature 002's surface)

**Performance Goals**: 3-second first-glance legibility; INP < 200ms; transitions < 300ms and
never blocking input; compositor-friendly animation only (transform/opacity); 60fps during
stage expand/illuminate

**Constraints**: Fully offline presentation + PDF generation (network only for send/archive,
loud failure, work preserved); no autoplay, no sound; Vietnamese UI with full diacritics on
screen and in PDF; laptop-only

**Scale/Scope**: One active consultation per machine; 9-rung ladder; ~10 screens/states in one
route; dozens of consultations per centre per day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | How this plan complies |
|---|-----------|------|------------------------|
| I | The metaphor is the argument | ✅ | Mountain renders bottom-to-top as the single presentation layout; no view or PDF section orders stages top-down (PDF timeline renders the climb, not a table). Design review gate in tasks. |
| II | Ladder integrity enforced | ✅ | Reuses 002's pure engine whose contiguous-slice invariant is already exhaustively tested; summit request cannot express a skip. Engine alignment (INT append per FR-003) keeps the invariant and its tests. Manual review-edits warn (FR-019) and never alter generation. |
| III | Provisional visibly provisional | ✅ | Mode is a discriminated union in the consultation data (`placement: measured \| estimated`), not a style flag. The PDF cover and screen renderer branch on it structurally; there is no renderer path that accepts an estimated placement without the caveat (see contracts/presentation.md). |
| IV | Two thresholds never merged | ✅ | `thresholds.ts` (002) is already the single canonical module with two separate objects; every surface imports it; tests pin exact rendering (SC-005). No new copy of the numbers anywhere. |
| V | Never depends on the network | ✅ | All content data bundled; engine pure; PDF client-side. Send/archive is the only network step, fails loudly, preserves the blob + form state for retry. Service worker precaches the route for cold-start offline (research D-OFFLINE). |
| VI | Nothing blocks speech | ✅ | No autoplay, no sound, transitions transform/opacity ≤ 300ms and interruptible; every state one action away (contracts/presentation.md state map). |
| VII | Content is data, never code | ✅ | Pricing, proof, FAQ join the existing content modules under `src/lib/domain/ielts/`; components import, never inline, user-facing strings. Review gate: any inline Vietnamese string is a defect. |
| VIII | Original visual identity | ✅ | `brand.ts` tokens (navy #2B3A8C, red #D01F26, Montserrat/Sansita) are the only identity source; no Olympia asset, name, or device anywhere; mascot used as climber per design contract. |
| IX | Consent gates proof | ✅ | Proof content module exports only a consent-branded type; entries without confirmed consent are unexportable from the module — structurally unrenderable (research D-PROOF), same barrier pattern as `StudentRoadmapView`. |
| — | Scope boundary | ✅ | Single route, laptop layout only; no student/parent-facing surfaces added; no responsive phone work. |

**Initial gate result: PASS** (no violations to justify — Complexity Tracking empty).

**Post-design re-check (after Phase 1): PASS** — the design artifacts introduce no violation:
the only network-coupled elements (email delivery, archive) sit strictly on the send step; all
new user-facing copy lands in content modules; the Mode union and consent brand are encoded in
data-model.md types.

## Project Structure

### Documentation (this feature)

```text
specs/005-ielts-summit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── summit-engine.md
│   ├── presentation.md
│   ├── delivery-archive.md
│   └── content-data.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/domain/ielts/            # Content data (Principle VII) — extended, not replaced
│   ├── bands.ts                 # (002) band scale — reused
│   ├── courses.ts               # (002) ladder — reused; PRE_S duration note (research D-PRES)
│   ├── thresholds.ts            # (002) canonical two thresholds — reused untouched
│   ├── narrative/               # (002) tier-shaped narrative — reused
│   ├── ecosystem.ts             # (002) Hệ sinh thái items — reused
│   ├── brand.ts                 # (002) brand tokens — extended (mascot, mountain palette)
│   ├── pricing.ts               # NEW: per-centre price lists (content data)
│   ├── proof.ts                 # NEW: consent-branded proof records (content data)
│   └── faq.ts                   # NEW: objection-keyed FAQ entries (content data)
├── services/ielts/
│   ├── roadmap-engine.ts        # (002) pure engine — shared slice logic reused
│   ├── summit-engine.ts         # NEW: SummitRequest → SummitRoadmap (wraps engine, FR-003 append,
│   │                            #      pricing totals, mode carriage)
│   ├── proof-match.ts           # NEW: pure journey-matching over consented proof
│   └── delivery/
│       ├── adapter.ts           # (002) seam — reused untouched
│       ├── download-maildraft.ts# (002) — retained as fallback
│       └── email-send.ts        # NEW: real email adapter (server action + provider)
├── schemas/summit.ts            # NEW: Zod schemas for capture + send boundary
├── app/actions/roadmap/
│   ├── send-summit-roadmap.ts   # NEW: send + archive (one action, withError pipeline)
│   └── list-sent-roadmaps.ts    # NEW: academic-team audit listing
├── app/(app)/lo-trinh-ielts/    # Route becomes the Summit (002 UI evolves in place)
│   ├── page.tsx
│   ├── Summit.tsx               # NEW: presentation shell + state map
│   ├── Mountain.tsx             # NEW: the climb (SVG/CSS, bottom-to-top)
│   ├── StagePanel.tsx           # NEW: one-at-a-time stage narrative
│   ├── SummarySurface.tsx       # NEW: buổi/duration/finish/price
│   ├── ProofSummit.tsx          # NEW: matched, consented proof
│   ├── SecondaryContent.tsx     # NEW: ecosystem / commitments / FAQ one-action access
│   ├── ReviewSend.tsx           # 002 RoadmapReview evolves: inline edit, capture, send, reset
│   └── pdf → src/lib/ielts/pdf/RoadmapDocument.tsx  # (002) evolves: cover caveat, price, proof
├── lib/ielts/pdf/fonts.ts       # (002) Montserrat VN subset — verify Sansita (research D-FONT)
└── public/sw.js                 # NEW: minimal precache service worker (research D-OFFLINE)

supabase/migrations/             # NEW: summit_sends table + storage bucket + RLS
tests/
├── unit/ielts/                  # engine (002, extended), summit-engine, pricing, proof-match,
│   │                            # mode gating, threshold rendering
└── integration/                 # archive RLS (centre-write / academic-read), send action
```

**Structure Decision**: Single Next.js project, extending feature 002's existing IELTS surface
in place. The `lo-trinh-ielts` route becomes the Summit; 002's engine, content modules, PDF
pipeline, and delivery seam are reused. New code follows the established layering: content data
in `lib/domain/ielts/`, pure logic in `services/ielts/`, boundary validation in `schemas/`,
mutations through `app/actions/` server actions, UI in the route folder.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
