# Jaxtina IELTS Summit — Racecourse Redesign

## Context

The user attached `jaxtina-ielts-marathon (1).html` — a fully self-contained vanilla HTML/CSS/JS
prototype ("IELTS Marathon", racecourse/start-to-finish metaphor) — and asked to embed its
PDF-generation and email-sending feature into the live page at `/lo-trinh-ielts`.

Investigation found that `/lo-trinh-ielts` is NOT a blank slate: it's the fully-implemented
slice `005-ielts-summit` (spec/plan/tasks all complete), a "mountain" (vertical climb) live
presentation tool with:
- Mode A/B (measured vs. estimated placement) with a structural "provisional" barrier
- Consent-gated real-student proof matching (`proof.ts` — a type-level barrier; unconsented
  entries are literally unreachable, not just filtered)
- Two distinct commitment thresholds (completion certificate vs. written output guarantee)
- FAQ, ecosystem/support content
- Server-side PDF (`@react-pdf/renderer`) + real email via Resend + Supabase archive record
  (`send-summit-roadmap.ts`), with a `download-maildraft.ts` mailto adapter kept only as an
  explicit consultant-facing fallback on send failure

The HTML prototype independently reimplements nearly the same domain logic (course ladder,
band-based route building, per-stage narrative, pricing, proof, FAQ, commitments) using its own
vanilla-JS engine, plus browser print-to-PDF and a `mailto:` link for sending — no server
involvement at all.

Wiring the HTML in as-is would create two parallel, disconnected implementations of the same
business logic. Instead — confirmed with the user across several brainstorming questions — this
is a **visual/UX redesign of the existing Summit page** (mountain → racecourse), reusing the
current architecture end to end. One genuine feature gap was found and will be added: **discount
pricing**, which the current pricing module explicitly excludes by design; the user chose to
reverse that decision.

### Decisions made during brainstorming

1. **Relationship to existing Summit**: Replace it (not a new parallel page, not just data reuse).
2. **PDF/email mechanism**: Keep the existing server-side pipeline (`@react-pdf/renderer` +
   Resend + archive) — do NOT switch to the prototype's browser-print + mailto approach.
3. **Visual direction**: Racecourse (horizontal, start-line → finish-line), confirmed via visual
   companion over the vertical mountain.
4. **Page layout**: Full-bleed racecourse hero across the top (option C) — not a top-strip-plus-
   fixed-columns layout, not a left rail.
5. **Stage detail interaction**: Right-side drawer slides in when a checkpoint is clicked (option
   C) — racecourse shrinks slightly to make room; not a permanent bottom dock, not a floating
   overlay card.
6. **Promo/discount pricing**: Add back — both percent AND fixed-VND-amount, chip-selectable
   (0/5/10/15% quick picks + custom input with a %/₫ toggle, matching the prototype). Lives
   inline in the live-presentation summary cell (not deferred to Review & Send).
7. **Grammar Pathway (GP) course**: Keep it in the domain data — moot for this surface anyway,
   since `summit-engine.ts`'s `DISPLAY_LADDER` already excludes GP from the Summit's rendered
   ladder (comment: "GP never appears"). No engine change needed either way.

## Architecture: what changes vs. what stays

**Stays completely untouched:**
- `src/services/ielts/summit-engine.ts`, `roadmap-engine.ts`, `placement-view.ts`,
  `review-edits.ts`, `proof-match.ts` — all pure domain logic
- `src/services/ielts/delivery/email-send.ts`, `src/app/actions/roadmap/send-summit-roadmap.ts`
  — server-side send + archive pipeline
- `src/lib/ielts/pdf/SummitDocument.tsx` — PDF renderer (content sections stay the same:
  cover → climb timeline → per-course cards → commitments → ecosystem → contact; only the
  cover/timeline visual styling picks up the new palette, and price rows gain a discount line)
- `src/lib/domain/ielts/{courses,bands,thresholds,ecosystem,faq,proof,brand}.ts` — domain content
  (only `brand.ts` gets new racecourse-specific tokens added, nothing removed)
- `src/schemas/summit.ts`, `src/services/ielts/summit-types.ts` (extended, not replaced — see
  below)
- `summit-state.ts` reducer shape (extended with discount fields)

**Replaced / heavily changed (visual + interaction layer only):**
- `Mountain.tsx` → new `Racecourse.tsx` (or renamed in place): horizontal track, checkpoints as
  circular markers left→right, skyline/gradient background reused from `BRAND.mountain` tokens
  (renamed/extended to a `BRAND.racecourse` token set: navy→red→gold gradient, skyline silhouette
  color, confetti color), current-position marker uses the existing mascot asset
  (`BRAND.asset.mascotClimber`) since Constitution VIII forbids decorative-only branding swaps
- `StagePanel.tsx` → same narrative content, restyled to render inside a slide-in drawer
  container instead of the current fixed side panel
- `Summit.tsx` (shell) → layout restructured: full-bleed racecourse hero at top, drawer overlay
  for stage detail, summary cell below/beside hero (exact position finalized during
  implementation planning, not load-bearing for this design)
- `SummarySurface.tsx` → adds the discount/promo control block (chips + custom input) and a
  "gross / discount / net" breakdown row when a discount is active, otherwise renders the
  existing single total line unchanged

**New:**
- `Discount` type + apply logic: a small pure function (co-located with `pricing.ts` or a new
  `pricing-discount.ts`) taking `{ type: "percent" | "amount"; value: number }` and a gross total,
  returning `{ gross, off, net, hasDiscount }` — mirrors the prototype's `priceBreakdown()` shape.
  Percent values clamp 0–100; amount values clamp 0–gross (never negative net).
- Discount chip presets: 0%, 5%, 10%, 15% (from the prototype) plus free-text custom value with a
  percent/₫ toggle.
- Discount state lives in the Summit reducer (`summit-state.ts`) as ephemeral UI state — NOT
  persisted to `SummitRequest`/`SummitRoadmap` engine types (those stay pure/arithmetic per
  Constitution). Discount is applied as a display-layer transform over `roadmap.totalPrice`,
  threaded through to `ReviewSend`/PDF/archive the same way `consultantNotes`/manual edits
  already are.

## Data model addition: discount

```ts
export type DiscountInput =
  | { type: "percent"; value: number } // 0–100
  | { type: "amount"; value: number }; // VND, 0–gross

export interface PriceBreakdown {
  gross: number;
  off: number;
  net: number;
  hasDiscount: boolean;
}

export function applyDiscount(gross: number, discount: DiscountInput | null): PriceBreakdown;
```

This gets threaded anywhere `roadmap.totalPrice.amount` currently renders as the final number:
`SummarySurface`, `ReviewSend` capture/preview, and the PDF cover + climb-timeline price row
(`SummitDocument.tsx`), same as the prototype's cover/climb sections show gross+off+net when a
discount is active.

## Verification

- `npm run typecheck` and `npm run lint` after changes — no type errors, discount fields
  correctly threaded through `SummitRoadmap`-adjacent state without touching the pure engine's
  return type.
- `npm run test` — existing Summit unit/integration tests (engine, pricing, mode-gating,
  consent-gating) must stay green since none of those modules change; add new unit tests for
  `applyDiscount` (percent clamp, amount clamp, zero-discount passthrough).
- Manual run: `npm run dev`, open `/lo-trinh-ielts`, walk through: set bands → see racecourse
  render correct climb slice → open a stage (drawer slides in) → apply a discount chip → total
  updates → Review & Send → PDF preview shows gross/discount/net → send (or simulate failure)
  → archive record created. Confirm Mode B (estimated) provisional treatment still renders
  distinctly on the racecourse start marker and PDF cover, unchanged from today.
- Visual check at 3 breakpoints (this is an internal consultant tool used on a laptop during
  live consultations, so no phone breakpoint needed, but confirm it doesn't break on a smaller
  laptop width ~1280px).
