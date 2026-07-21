# What to hand back

This folder is going to Claude (claude.ai) to design a system, most likely as one or more Artifacts. To
make the result easy to bring back into the actual Next.js/Tailwind v4 codebase, structure the output as
follows.

## 1. A token system (the foundation)

A concrete, complete set of design tokens — not just a palette swatch, but values ready to paste into
`globals.css` as CSS custom properties under `@theme` (Tailwind v4's native token mechanism). Include:

- **Color**: primary/secondary brand colors derived from navy `#2B3A8C` / red `#D01F26`, a full neutral
  ramp for text/backgrounds/borders, and — critically — real light **and** dark values for every state
  color listed in `01-CODEBASE-CONTEXT.md` (task priority ×3, KPI attainment ×4, ideally HR request
  status ×6 and task status ×6 too). Each state color as a text/bg/border triple, matching the existing
  `BadgeColor` shape.
- **Type**: the confirmed body/display pairing (Montserrat body, confirm or replace Sansita for
  display — your call, but justify it against the Vietnamese-diacritics constraint), a type scale
  (heading sizes down to table/caption text), and weight usage rules.
- **Spacing/layout**: a spacing scale if you deviate from Tailwind's default, sidebar width, content
  max-width/padding, table row height/density.
- **Elevation/radius**: card/panel shadow and border-radius conventions if used — state whether this
  system uses elevation (shadows) or flat/bordered surfaces as its primary depth cue, and why.

## 2. Component specs, not just a moodboard

For a tool this form/table/board-heavy, the highest-value output is worked-out patterns for:

- **Sidebar nav** (active-route state, role label placement, logo placement, logout affordance)
- **Status/state badge** (single component, parameterized by the triple-token color — this is reused
  across Tasks/KPI/HR everywhere)
- **Data table** (header, row hover, zebra vs. not, sort affordance, empty state, pagination if shown)
- **Kanban card + column** (Tasks board — the busiest surface in the app)
- **Form field** (label, input, select, date-range pair, validation error state, required-field
  indicator) — reused across all 9 HR request forms
- **Button** (primary/secondary/destructive, loading/disabled states)
- **Empty state** (several pages will show "no data for this filter" — give this a real, on-brand
  treatment rather than a bare sentence)

A live interactive Artifact (HTML/CSS or React) demonstrating these components together is more useful
than static images — this will most likely get re-implemented as real Tailwind classes + React
components afterward, so precise states (hover/focus/disabled/error) matter more than illustration.

## 3. At least one full page mockup

Pick the two highest-value targets and mock them up fully, in-context, with realistic Vietnamese sample
data (not lorem ipsum — use plausible Vietnamese names, dates, task titles):

1. **The Tasks Kanban board** (`/tasks`) — highest traffic, most complex layout.
2. **The HR Reports page** (`/nhan-su/bao-cao`) — currently the least-styled page in the app, a clean
   target to demonstrate the new data-table pattern.

If time/scope allows, a third mockup of the app shell alone (sidebar + an empty content area) is
valuable since every other page inherits it.

## 4. A short rationale note

2-3 paragraphs on the design decisions: why this palette extension from navy/red, why this type pairing,
what the "signature element" of the system is (per design-lead practice: one deliberate, memorable
choice, not decoration everywhere) and how it specifically serves this product — a multi-centre
Vietnamese IELTS-chain ops tool — rather than reading as a generic enterprise dashboard template.

## What NOT to spend effort on

- The IELTS Roadmap Builder page (`/lo-trinh-ielts`) itself — out of scope, has its own established
  visual system already (see brief).
- Building this as production Next.js code — Artifacts/mockups are the deliverable; a developer will
  port the confirmed system into the real Tailwind v4 `@theme` config and React components afterward.
- Inventing new Vietnamese copy for features that already have real strings in `vocabulary.ts` — reuse
  the existing labels (Chờ duyệt, Đã duyệt, etc.) rather than rewriting them; only write new copy for
  genuinely new UI moments (empty states, new microcopy) not already covered.
