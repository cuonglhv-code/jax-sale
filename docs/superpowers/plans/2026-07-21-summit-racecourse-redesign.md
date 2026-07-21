# Summit Racecourse Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mountain-metaphor visual layer of the Jaxtina IELTS Summit page (`/lo-trinh-ielts`) with a racecourse metaphor (horizontal, start-line → finish-line), and add discount pricing (percent + fixed VND) — while keeping every domain/engine/PDF/email/archive module untouched.

**Architecture:** Pure visual-layer swap. `Mountain.tsx` becomes `Racecourse.tsx` (horizontal track, full-bleed hero); `StagePanel.tsx` renders inside a new right-side sliding drawer instead of a fixed column; `Summit.tsx`'s layout is restructured around those two. Discount is a small new pure function (`applyDiscount`) plus ephemeral reducer state — never touches `SummitRoadmap`/`SummitRequest`, which stay pure and arithmetic. The discounted net total is what gets passed to `sendAndArchive`, exactly where `ReviewSend.tsx` already passes `reviewed.totalPrice.amount` today.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, `@react-pdf/renderer`, Vitest.

## Global Constraints

- All user-facing Vietnamese strings live in `src/lib/domain/ielts/summit-copy.ts` (`SUMMIT_COPY`) — never inline in components (Constitution VII).
- Motion is transform/opacity only, ≤300ms, interruptible, and respects `motion-reduce` (Constitution VI, matches existing `Mountain.tsx`/`StagePanel.tsx` pattern: `transition-[transform,opacity] duration-300 motion-reduce:transition-none`).
- `SummitRoadmap`/`SummitRequest`/the pure engine (`summit-engine.ts`) must NOT change — discount is a display-layer concern applied on top of `roadmap.totalPrice.amount`.
- Brand colors/fonts come from `BRAND` (`src/lib/domain/ielts/brand.ts`) — never hardcode hex values in components.
- Mode A/B (measured vs. estimated placement) provisional treatment must keep rendering distinctly on whatever replaces the mountain's `StartMarker`, using the same `provisionalTreatmentFor` single decision point (Constitution III) — no new branch point.
- Every new pure function gets a Vitest unit test in `tests/unit/ielts/` before being wired into a component (existing repo convention — see `tests/unit/ielts/summit-pricing.test.ts`).
- Run `npm run typecheck` and `npm run lint` after every task; do not proceed to the next task if either fails.

---

### Task 1: Discount pure function + tests

**Files:**
- Create: `src/lib/domain/ielts/pricing-discount.ts`
- Test: `tests/unit/ielts/summit-discount.test.ts`

**Interfaces:**
- Produces: `DiscountInput` type, `PriceBreakdown` interface, `applyDiscount(gross: number, discount: DiscountInput | null): PriceBreakdown` — consumed by Task 4 (SummarySurface), Task 6 (ReviewSend), Task 7 (PDF).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ielts/summit-discount.test.ts
import { describe, it, expect } from "vitest";
import { applyDiscount } from "@/lib/domain/ielts/pricing-discount";

describe("applyDiscount", () => {
  it("returns the gross total unchanged with no discount", () => {
    const result = applyDiscount(10_000_000, null);
    expect(result).toEqual({ gross: 10_000_000, off: 0, net: 10_000_000, hasDiscount: false });
  });

  it("applies a percent discount", () => {
    const result = applyDiscount(10_000_000, { type: "percent", value: 15 });
    expect(result).toEqual({ gross: 10_000_000, off: 1_500_000, net: 8_500_000, hasDiscount: true });
  });

  it("applies a fixed-amount discount", () => {
    const result = applyDiscount(10_000_000, { type: "amount", value: 2_000_000 });
    expect(result).toEqual({ gross: 10_000_000, off: 2_000_000, net: 8_000_000, hasDiscount: true });
  });

  it("clamps percent to 0-100", () => {
    const over = applyDiscount(10_000_000, { type: "percent", value: 150 });
    expect(over).toEqual({ gross: 10_000_000, off: 10_000_000, net: 0, hasDiscount: true });

    const under = applyDiscount(10_000_000, { type: "percent", value: -20 });
    expect(under).toEqual({ gross: 10_000_000, off: 0, net: 10_000_000, hasDiscount: false });
  });

  it("clamps a fixed amount to [0, gross] so net never goes negative", () => {
    const over = applyDiscount(10_000_000, { type: "amount", value: 99_000_000 });
    expect(over).toEqual({ gross: 10_000_000, off: 10_000_000, net: 0, hasDiscount: true });

    const under = applyDiscount(10_000_000, { type: "amount", value: -5_000_000 });
    expect(under).toEqual({ gross: 10_000_000, off: 0, net: 10_000_000, hasDiscount: false });
  });

  it("a zero-value discount of either type reports hasDiscount: false", () => {
    expect(applyDiscount(10_000_000, { type: "percent", value: 0 }).hasDiscount).toBe(false);
    expect(applyDiscount(10_000_000, { type: "amount", value: 0 }).hasDiscount).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ielts/summit-discount.test.ts`
Expected: FAIL with "Cannot find module '@/lib/domain/ielts/pricing-discount'" (or similar resolution error).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/domain/ielts/pricing-discount.ts
/**
 * Discount applied on top of the Summit's arithmetic total (display-layer only — never part of
 * SummitRoadmap/SummitRequest, which stay pure per the engine's "no discount fields" design).
 * Percent clamps to 0-100; fixed amount clamps to [0, gross] so net is never negative.
 */

export type DiscountInput =
  | { type: "percent"; value: number }
  | { type: "amount"; value: number };

export interface PriceBreakdown {
  gross: number;
  off: number;
  net: number;
  hasDiscount: boolean;
}

export function applyDiscount(gross: number, discount: DiscountInput | null): PriceBreakdown {
  if (!discount) {
    return { gross, off: 0, net: gross, hasDiscount: false };
  }

  const off =
    discount.type === "percent"
      ? Math.round(gross * (Math.min(Math.max(discount.value, 0), 100) / 100))
      : Math.min(Math.max(discount.value, 0), gross);

  return { gross, off, net: gross - off, hasDiscount: off > 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ielts/summit-discount.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/ielts/pricing-discount.ts tests/unit/ielts/summit-discount.test.ts
git commit -m "feat(ielts): add applyDiscount pure function for Summit pricing"
```

---

### Task 2: Discount UI copy + brand racecourse tokens

**Files:**
- Modify: `src/lib/domain/ielts/summit-copy.ts`
- Modify: `src/lib/domain/ielts/brand.ts`

**Interfaces:**
- Produces: `SUMMIT_COPY.discount.*` keys (consumed by Task 4), `BRAND.racecourse.*` token object (consumed by Task 5).

- [ ] **Step 1: Add discount copy to `summit-copy.ts`**

Insert after the `totalPriceLabel` line (currently `src/app/(app)/lo-trinh-ielts` imports show it at line 34 of `summit-copy.ts`, inside the "Summary surface" block):

```ts
  /** Discount / promo pricing (display-layer only — never in the pure engine). */
  discount: {
    label: "Khuyến mãi",
    percentSuffix: "%",
    customPlaceholder: "Tùy chỉnh",
    unitPercent: "%",
    unitAmount: "₫",
    grossLabel: "Giá gốc",
    offLabel: "Giảm giá",
    netLabel: "Thành tiền",
  },
```

- [ ] **Step 2: Add racecourse tokens to `brand.ts`**

Insert after the `mountain` object (before the closing `} as const;`):

```ts
  /** Racecourse scene palette (Summit redesign 2026-07) — sunrise gradient: night start line to
   *  golden finish line. Derived from Jaxtina's own navy/red identity (Constitution VIII — no
   *  other programme's palette or device). */
  racecourse: {
    trackStart: "#141B45",
    trackMid: "#2B3A8C",
    trackEnd: "#F2C063",
    checkpointDim: "#B9C0DD",
    checkpointLit: "#D01F26",
    checkpointGlow: "#FF8A8E",
    finishGold: "#FFD9A0",
    skylineColor: "rgba(255,255,255,0.12)",
  },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (both are additive `as const` object literals, no existing consumer touches these new keys yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/domain/ielts/summit-copy.ts src/lib/domain/ielts/brand.ts
git commit -m "feat(ielts): add discount copy and racecourse brand tokens"
```

---

### Task 3: Discount state in the Summit reducer

**Files:**
- Modify: `src/app/(app)/lo-trinh-ielts/summit-state.ts`
- Test: `tests/unit/ielts/summit-ui.test.tsx` (add new `describe` block; existing file already tests reducer behavior per repo convention)

**Interfaces:**
- Consumes: `DiscountInput` from `@/lib/domain/ielts/pricing-discount` (Task 1).
- Produces: `SummitState.discount: DiscountInput | null`, `SummitAction` variant `{ type: "setDiscount"; discount: DiscountInput | null }` — consumed by Task 4 (`Summit.tsx` dispatch wiring) and Task 4 (`SummarySurface.tsx` reading `state.discount`).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/ielts/summit-ui.test.tsx` (append a new `describe` block; check the file's existing imports first — it already imports `summitReducer`/`INITIAL_SUMMIT_STATE` per repo convention):

```ts
describe("summitReducer — discount", () => {
  it("starts with no discount", () => {
    expect(INITIAL_SUMMIT_STATE.discount).toBeNull();
  });

  it("setDiscount stores the discount input", () => {
    const next = summitReducer(INITIAL_SUMMIT_STATE, {
      type: "setDiscount",
      discount: { type: "percent", value: 10 },
    });
    expect(next.discount).toEqual({ type: "percent", value: 10 });
  });

  it("setDiscount(null) clears an existing discount", () => {
    const withDiscount = summitReducer(INITIAL_SUMMIT_STATE, {
      type: "setDiscount",
      discount: { type: "percent", value: 10 },
    });
    const cleared = summitReducer(withDiscount, { type: "setDiscount", discount: null });
    expect(cleared.discount).toBeNull();
  });

  it("confirmReset clears the discount along with everything else", () => {
    const withDiscount = summitReducer(INITIAL_SUMMIT_STATE, {
      type: "setDiscount",
      discount: { type: "amount", value: 500_000 },
    });
    const reset = summitReducer(withDiscount, { type: "confirmReset" });
    expect(reset.discount).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ielts/summit-ui.test.tsx -t "summitReducer — discount"`
Expected: FAIL — `discount` is `undefined` on state / `"setDiscount"` action not handled (TypeScript error on the action type, or runtime `undefined` mismatch).

- [ ] **Step 3: Implement — modify `summit-state.ts`**

Add the import at the top:

```ts
import type { DiscountInput } from "@/lib/domain/ielts/pricing-discount";
```

Add `discount` to `SummitState` (after `sentAt: string | null;`):

```ts
  sentAt: string | null;
  /** Display-layer only — never part of SummitRequest/SummitRoadmap (Constitution: pure engine). */
  discount: DiscountInput | null;
```

Add `discount: null` to `INITIAL_SUMMIT_STATE` (after `sentAt: null,`):

```ts
  sentAt: null,
  discount: null,
```

Add the action variant to `SummitAction` (after `{ type: "setPlacement"; placement: Placement }`):

```ts
  | { type: "setDiscount"; discount: DiscountInput | null }
```

Add the case in `summitReducer` (after the `case "setPlacement":` block):

```ts
    case "setDiscount":
      return { ...state, discount: action.discount };
```

Because `confirmReset` and `requestReset`'s non-warning branch already return `{ ...INITIAL_SUMMIT_STATE }`, discount is cleared automatically — no extra code needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ielts/summit-ui.test.tsx -t "summitReducer — discount"`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/lo-trinh-ielts/summit-state.ts tests/unit/ielts/summit-ui.test.tsx
git commit -m "feat(ielts): add discount to Summit reducer state"
```

---

### Task 4: Discount UI in SummarySurface

**Files:**
- Modify: `src/app/(app)/lo-trinh-ielts/SummarySurface.tsx`
- Modify: `src/app/(app)/lo-trinh-ielts/Summit.tsx` (wire `state.discount` + dispatch through as new props)

**Interfaces:**
- Consumes: `applyDiscount`, `DiscountInput` (Task 1); `SUMMIT_COPY.discount.*` (Task 2); `state.discount`, `setDiscount` action (Task 3).
- Produces: `SummarySurface` gains two new required props: `discount: DiscountInput | null`, `onDiscountChange: (discount: DiscountInput | null) => void`.

**Note on testing:** this repo has no component-rendering test infrastructure — `@testing-library/react` is not installed, `vitest.config.ts` sets `environment: "node"`, and every existing `*.test.tsx` file (e.g. `summit-ui.test.tsx`, `placement-mode.test.tsx`) tests pure reducer/logic functions only, never renders JSX. Do not introduce RTL here as a one-off. `SummarySurface`'s new logic (which chip is "active", when the breakdown line shows) is already fully covered by Task 1's `applyDiscount` unit tests since the component is a thin render of that function's output; the wiring itself is verified in Task 8's manual walkthrough (Step 3.3).

- [ ] **Step 1: Implement — modify `SummarySurface.tsx`**

Replace the full file content:

```tsx
"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { formatVnd } from "@/lib/domain/ielts/pricing";
import { applyDiscount, type DiscountInput } from "@/lib/domain/ielts/pricing-discount";
import type { SummitRoadmap } from "@/services/ielts/summit-types";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";

/** "43–53 tuần (≈10–12 tháng)" — always a range, never false precision (FR-004). */
export function formatDurationRange(roadmap: SummitRoadmap): string {
  const w = roadmap.durationWeeks;
  const m = roadmap.durationMonths;
  return `${Math.round(w.min)}–${Math.round(w.max)} ${SUMMIT_COPY.weeksUnit} (≈${Math.round(m.min)}–${Math.round(m.max)} ${SUMMIT_COPY.monthsUnit})`;
}

function formatFinishWindow(roadmap: SummitRoadmap): string {
  if (!roadmap.projectedFinish) return "—";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("vi-VN", { month: "numeric", year: "numeric" });
  return `${fmt(roadmap.projectedFinish.earliest)} – ${fmt(roadmap.projectedFinish.latest)}`;
}

const DISCOUNT_PERCENT_PRESETS = [0, 5, 10, 15] as const;

type Props = {
  roadmap: SummitRoadmap;
  discount: DiscountInput | null;
  onDiscountChange: (discount: DiscountInput | null) => void;
};

/** The climb's summary: buổi, duration range, projected finish, discounted total (FR-007). */
export function SummarySurface({ roadmap, discount, onDiscountChange }: Props) {
  // Same single decision point as the racecourse marker and PDF cover (Constitution III).
  const treatment = provisionalTreatmentFor(roadmap.request.placement);
  const prefix = treatment ? `${treatment.estimatePrefix} ` : "";
  const breakdown = applyDiscount(roadmap.totalPrice.amount, discount);

  return (
    <section
      aria-label={SUMMIT_COPY.summaryTitle}
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: `${BRAND.color.navy}22` }}
    >
      <h2 className="mb-3 text-lg font-bold" style={{ color: BRAND.color.navy }}>
        {SUMMIT_COPY.summaryTitle}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Item label={SUMMIT_COPY.totalSessionsLabel}>
          {roadmap.totalSessions} {SUMMIT_COPY.sessionsUnit}
        </Item>
        <Item label={SUMMIT_COPY.durationLabel}>
          {prefix}
          {formatDurationRange(roadmap)}
        </Item>
        <Item label={SUMMIT_COPY.projectedFinishLabel}>
          {prefix}
          {formatFinishWindow(roadmap)}
        </Item>
        <Item label={SUMMIT_COPY.totalPriceLabel} emphasized>
          {prefix}
          {formatVnd(breakdown.net)}
        </Item>
      </dl>
      {roadmap.hasFlexibleBase && (
        <p className="mt-3 text-xs text-neutral-600">{SUMMIT_COPY.preSFlexibleNote}</p>
      )}
      {roadmap.totalPrice.excludesUnpriced && (
        <p className="mt-1 text-xs text-neutral-600">{SUMMIT_COPY.excludesUnpricedNote}</p>
      )}

      <DiscountControl discount={discount} onDiscountChange={onDiscountChange} breakdown={breakdown} />
    </section>
  );
}

function DiscountControl({
  discount,
  onDiscountChange,
  breakdown,
}: {
  discount: DiscountInput | null;
  onDiscountChange: (discount: DiscountInput | null) => void;
  breakdown: ReturnType<typeof applyDiscount>;
}) {
  const activePercent = discount?.type === "percent" ? discount.value : null;

  return (
    <div className="mt-4 rounded-xl border p-3" style={{ borderColor: `${BRAND.color.navy}22` }}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: BRAND.color.navy }}>
        {SUMMIT_COPY.discount.label}
      </p>
      <div className="flex flex-wrap gap-2">
        {DISCOUNT_PERCENT_PRESETS.map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => onDiscountChange(pct === 0 ? null : { type: "percent", value: pct })}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={
              activePercent === pct || (pct === 0 && !discount)
                ? { backgroundColor: BRAND.color.navy, color: "#FFFFFF", borderColor: BRAND.color.navy }
                : { color: BRAND.color.navy, borderColor: `${BRAND.color.navy}55` }
            }
          >
            {pct}%
          </button>
        ))}
        <CustomDiscountInput discount={discount} onDiscountChange={onDiscountChange} />
      </div>
      {breakdown.hasDiscount && (
        <p className="mt-2 text-xs text-neutral-600">
          <s>{formatVnd(breakdown.gross)}</s> · {SUMMIT_COPY.discount.offLabel} {formatVnd(breakdown.off)}
        </p>
      )}
    </div>
  );
}

function CustomDiscountInput({
  discount,
  onDiscountChange,
}: {
  discount: DiscountInput | null;
  onDiscountChange: (discount: DiscountInput | null) => void;
}) {
  const unit = discount?.type === "amount" ? "amount" : "percent";

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        placeholder={SUMMIT_COPY.discount.customPlaceholder}
        className="w-20 rounded-md border px-2 py-1 text-xs"
        onChange={(e) => {
          const value = Number(e.target.value);
          if (!e.target.value || Number.isNaN(value)) {
            onDiscountChange(null);
            return;
          }
          onDiscountChange({ type: unit, value });
        }}
      />
      <select
        value={unit}
        onChange={(e) => onDiscountChange(discount ? { type: e.target.value as "percent" | "amount", value: discount.value } : null)}
        className="rounded-md border px-1 py-1 text-xs"
      >
        <option value="percent">{SUMMIT_COPY.discount.unitPercent}</option>
        <option value="amount">{SUMMIT_COPY.discount.unitAmount}</option>
      </select>
    </div>
  );
}

function Item({
  label,
  emphasized,
  children,
}: {
  label: string;
  emphasized?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd
        className={emphasized ? "mt-0.5 text-xl font-extrabold" : "mt-0.5 text-base font-semibold"}
        style={emphasized ? { color: BRAND.color.red } : undefined}
      >
        {children}
      </dd>
    </div>
  );
}
```

- [ ] **Step 4: Wire into `Summit.tsx`**

In `src/app/(app)/lo-trinh-ielts/Summit.tsx`, find the line:

```tsx
            {state.view.kind === "summary" && <SummarySurface roadmap={roadmap} />}
```

Replace with:

```tsx
            {state.view.kind === "summary" && (
              <SummarySurface
                roadmap={roadmap}
                discount={state.discount}
                onDiscountChange={(discount) => dispatch({ type: "setDiscount", discount })}
              />
            )}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Run the existing Summit unit test suite (regression check)**

Run: `npx vitest run tests/unit/ielts/`
Expected: PASS — confirms Task 1/3's pure-logic tests this component depends on are still green.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/lo-trinh-ielts/SummarySurface.tsx" "src/app/(app)/lo-trinh-ielts/Summit.tsx"
git commit -m "feat(ielts): add discount chips + custom input to SummarySurface"
```

---

### Task 5: Racecourse component (replaces Mountain.tsx)

**Files:**
- Create: `src/app/(app)/lo-trinh-ielts/Racecourse.tsx`
- Delete: `src/app/(app)/lo-trinh-ielts/Mountain.tsx` (after confirming no other file imports it besides `Summit.tsx`, updated in Task 6)

**Interfaces:**
- Consumes: same props shape as the old `Mountain`: `{ stages: SummitStage[]; studentName: string; placement: Placement; expandedCode: string | null; onOpenStage: (code) => void }`.
- Produces: `Racecourse` component, `StartMarker`-equivalent — reuse the exact same function name `StartMarker` internally (not exported) so Mode A/B behavior is provably unchanged; exports `BandRangeLine` (unchanged, moved from `Mountain.tsx` verbatim since `OpeningControls.tsx` or others may import it — verify with grep in Step 0).

**Note on testing:** as in Task 4, this repo has no component-rendering test infrastructure, so this task has no new automated test. `StartMarker`'s Mode A/B branching is a straight port of `Mountain.tsx`'s existing `StartMarker` (same logic, only layout classes differ), and that decision point (`provisionalTreatmentFor`) is already unit-tested by `tests/unit/ielts/placement-mode.test.tsx` and `placement-types.test.ts` — porting it verbatim carries that coverage forward. The checkpoint layout itself (left-to-right rendering, click wiring) is verified in Task 8's manual walkthrough (Steps 3.1–3.2).

- [ ] **Step 0: Check for other consumers of `Mountain.tsx` exports before deleting**

Run: `grep -rn "from \"./Mountain\"" "src/app/(app)/lo-trinh-ielts/"`
Expected: only `Summit.tsx` imports `Mountain`. If `BandRangeLine` is imported elsewhere, note the importer and update it in Step 4 below to import from `Racecourse` instead.

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/lo-trinh-ielts/Racecourse.tsx`:

```tsx
"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { bandLabel } from "@/lib/domain/ielts/labels";
import type { SummitStage, Placement } from "@/services/ielts/summit-types";
import { assertNever } from "@/services/ielts/summit-types";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";

type Props = {
  /** Ladder order, start → finish (engine order: bottom-of-mountain === start-of-race). */
  stages: SummitStage[];
  studentName: string;
  placement: Placement;
  expandedCode: string | null;
  onOpenStage: (code: SummitStage["code"]) => void;
};

/** Per-state marker treatment: the climb is theirs; below recedes; above stays reachable. */
function checkpointClasses(state: SummitStage["state"], isExpanded: boolean): string {
  const base =
    "group flex flex-col items-center gap-1 transition-[transform,opacity] duration-300 motion-reduce:transition-none";
  switch (state) {
    case "climb":
      return `${base} opacity-100 hover:-translate-y-1 ${isExpanded ? "-translate-y-1" : ""}`;
    case "below":
      return `${base} opacity-40`;
    case "above":
      return `${base} opacity-60 hover:opacity-90`;
    default:
      return assertNever(state);
  }
}

/**
 * The racecourse (Summit redesign): the ladder reads start → finish, left to right, full-bleed
 * hero. Motion is transform/opacity only, ≤300ms, interruptible (Constitution VI, FR-011).
 */
export function Racecourse({ stages, studentName, placement, expandedCode, onOpenStage }: Props) {
  const r = BRAND.racecourse;

  return (
    <section
      aria-label="Đường chạy IELTS"
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: `linear-gradient(to right, ${r.trackStart}, ${r.trackMid} 55%, ${r.trackEnd})`,
      }}
    >
      {/* Finish glow — a state style, not a timed sequence (Constitution VI). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 opacity-60"
        style={{ background: `radial-gradient(ellipse at right, ${r.finishGold}, transparent 70%)` }}
      />

      <ol className="relative flex items-start justify-between gap-1 overflow-x-auto">
        {stages.map((stage, idx) => {
          const isExpanded = expandedCode === stage.code;
          const isStart = idx === stages.findIndex((s) => s.state === "climb");
          return (
            <li key={stage.code} className="flex-1">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => onOpenStage(stage.code)}
                className={checkpointClasses(stage.state, isExpanded)}
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  style={{
                    backgroundColor: stage.state === "climb" ? r.checkpointLit : "rgba(255,255,255,.12)",
                    borderColor: stage.state === "climb" ? "#FFFFFF" : r.checkpointDim,
                    color: "#FFFFFF",
                    boxShadow: stage.state === "climb" ? `0 0 12px ${r.checkpointGlow}` : undefined,
                  }}
                >
                  {stage.name.slice(0, 3)}
                </span>
                <span
                  className="max-w-[80px] text-center text-xs font-semibold"
                  style={{ color: stage.state === "climb" ? "#FFFFFF" : r.checkpointDim }}
                >
                  {stage.name}
                </span>
                {stage.sessions !== null && (
                  <span className="text-[10px]" style={{ color: r.checkpointDim }}>
                    {stage.sessions} {SUMMIT_COPY.sessionsUnit}
                  </span>
                )}
                {isStart && <StartMarker studentName={studentName} placement={placement} />}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Derives from `provisionalTreatmentFor` — THE single decision point (Constitution III). A
 * null treatment renders the measured marker; any non-null treatment renders the provisional
 * one, so a third Placement variant would need a new treatment shape before it could ever
 * reach this component silently as "measured". Identical logic to the former Mountain.tsx
 * StartMarker — only the layout classes differ (badge sits below the checkpoint, not inline).
 */
function StartMarker({ studentName, placement }: { studentName: string; placement: Placement }) {
  const treatment = provisionalTreatmentFor(placement);
  if (!treatment) {
    const testDate = placement.kind === "measured" ? placement.testDate : null;
    return (
      <span
        className="mt-1 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold"
        style={{ color: BRAND.color.navy }}
      >
        <span aria-hidden>🏁</span>
        {studentName || "…"} · {SUMMIT_COPY.measuredMarker}
        {testDate ? ` (${testDate})` : ""}
      </span>
    );
  }
  return (
    <span
      className="mt-1 flex items-center gap-1 rounded-full border-2 border-dashed px-2 py-0.5 text-[10px] font-bold"
      style={{ borderColor: BRAND.color.red, color: "#FFFFFF", backgroundColor: `${BRAND.color.red}CC` }}
    >
      <span aria-hidden>?</span>
      {studentName || "…"} · {treatment.marker}
    </span>
  );
}

/** Band range chip used by the opening summary line above the racecourse. */
export function BandRangeLine({ current, target }: { current: string; target: string }) {
  return (
    <p className="text-sm font-medium" style={{ color: BRAND.color.navy }}>
      {bandLabel(current as never)} → {bandLabel(target as never)}
    </p>
  );
}
```

- [ ] **Step 2: Update any other importers found in Step 0**

If Step 0's grep found an importer of `BandRangeLine` besides `Summit.tsx`, update its import path from `./Mountain` to `./Racecourse`. If none found, skip.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. `Mountain.tsx` still exists and is now unused by nothing except `Summit.tsx` (not yet rewired) — that's expected; do NOT delete it yet (Task 6 rewires `Summit.tsx` first, then deletes it, to avoid an intermediate broken import state).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/lo-trinh-ielts/Racecourse.tsx"
git commit -m "feat(ielts): add Racecourse component (replaces Mountain visual layer)"
```

---

### Task 6: Stage-detail drawer + Summit.tsx layout restructure

**Files:**
- Create: `src/app/(app)/lo-trinh-ielts/StageDrawer.tsx`
- Modify: `src/app/(app)/lo-trinh-ielts/Summit.tsx`
- Delete: `src/app/(app)/lo-trinh-ielts/Mountain.tsx` (finalize Task 5's deferred deletion)

**Interfaces:**
- Consumes: `StagePanel` (unchanged, from the neighbor file `StagePanel.tsx` — no modification needed, it already renders as a self-contained `<section>`).
- Produces: `StageDrawer` component wrapping `StagePanel` with slide-in styling; `Summit.tsx`'s JSX restructured to full-bleed `Racecourse` + drawer overlay.

**Note on testing:** as in Tasks 4–5, no component-rendering test infrastructure exists in this repo. `StageDrawer` is a thin conditional wrapper (`if (!stage) return null`) around the already-tested `StagePanel`; its correctness (renders when a stage is open, hidden otherwise, closes on the existing close control) is verified in Task 8's manual walkthrough (Step 3.2).

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/lo-trinh-ielts/StageDrawer.tsx`:

```tsx
"use client";

import type { SummitStage } from "@/services/ielts/summit-types";
import { StagePanel } from "./StagePanel";

type Props = {
  stage: SummitStage | null;
  onClose: () => void;
};

/**
 * Right-side sliding drawer for stage detail (Summit redesign 2026-07): the racecourse hero
 * shrinks to make room; StagePanel's content is unchanged, only the surrounding chrome differs
 * from the former fixed side-column placement. Renders nothing when no stage is open so the
 * caller doesn't need a separate `expandedStage &&` guard.
 */
export function StageDrawer({ stage, onClose }: Props) {
  if (!stage) return null;

  return (
    <div
      role="dialog"
      aria-label={stage.name}
      className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto p-4 shadow-2xl transition-transform duration-300 motion-reduce:transition-none"
      style={{ backgroundColor: "transparent" }}
    >
      <StagePanel stage={stage} onClose={onClose} />
    </div>
  );
}
```

- [ ] **Step 2: Restructure `Summit.tsx`**

Replace the block from `{roadmap && state.view.kind !== "review" && (` through its closing `)}` (the grid layout containing `Mountain`, the rail nav, `StagePanel`, `SummarySurface`, `SecondaryContent`, `ProofSummit`) with:

```tsx
      {roadmap && state.view.kind !== "review" && (
        <div className="flex flex-col gap-4">
          <Racecourse
            stages={roadmap.stages}
            studentName={state.studentName}
            placement={state.placement}
            expandedCode={expandedCode}
            onOpenStage={(code) => dispatch({ type: "openStage", code })}
          />

          {/* Persistent rail — every state one action away (FR-010). */}
          <nav aria-label="Điều hướng" className="flex flex-wrap gap-2">
            <RailButton
              isActive={state.view.kind === "summary"}
              onClick={() => dispatch({ type: "showSummary" })}
            >
              {SUMMIT_COPY.summaryTitle}
            </RailButton>
            <RailButton isActive={false} onClick={() => dispatch({ type: "enterReview" })}>
              {SUMMIT_COPY.railReview}
            </RailButton>
            <RailButton
              isActive={state.view.kind === "secondary" && state.view.tab === "ecosystem"}
              onClick={() => dispatch({ type: "openSecondary", tab: "ecosystem" })}
            >
              {SUMMIT_COPY.railEcosystem}
            </RailButton>
            <RailButton
              isActive={state.view.kind === "secondary" && state.view.tab === "commitments"}
              onClick={() => dispatch({ type: "openSecondary", tab: "commitments" })}
            >
              {SUMMIT_COPY.railCommitments}
            </RailButton>
            <RailButton
              isActive={state.view.kind === "secondary" && state.view.tab === "faq"}
              onClick={() => dispatch({ type: "openSecondary", tab: "faq" })}
            >
              {SUMMIT_COPY.railFaq}
            </RailButton>
          </nav>

          {state.view.kind === "summary" && (
            <SummarySurface
              roadmap={roadmap}
              discount={state.discount}
              onDiscountChange={(discount) => dispatch({ type: "setDiscount", discount })}
            />
          )}
          {state.view.kind === "secondary" && (
            <SecondaryContent tab={state.view.tab} onBack={() => dispatch({ type: "closeSecondary" })} />
          )}

          {/* The summit is what the climb earns — matched proof, always available (Story 4). */}
          {state.currentBand && state.targetBand && (
            <ProofSummit currentBand={state.currentBand} targetBand={state.targetBand} />
          )}

          <StageDrawer stage={expandedStage} onClose={() => dispatch({ type: "closeStage" })} />
        </div>
      )}
```

Note: the old `RailButton` for "back to mountain" (`SUMMIT_COPY.railBack` / `showMountain`) is removed — there's no separate mountain/stage view to navigate back from anymore, since the racecourse is always visible and the drawer overlays it. `showMountain`/`closeStage` actions in the reducer still exist and still work (closing the drawer dispatches `closeStage`, which sets `view: { kind: "mountain" }` — harmless, since the racecourse always renders regardless of `view.kind` in this new layout).

Also update the import line near the top of `Summit.tsx`:

```tsx
import { Mountain } from "./Mountain";
```

to:

```tsx
import { Racecourse } from "./Racecourse";
import { StageDrawer } from "./StageDrawer";
```

- [ ] **Step 3: Now delete `Mountain.tsx` (completes Task 5's deferred deletion)**

Run: `git rm "src/app/(app)/lo-trinh-ielts/Mountain.tsx"`

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors — confirm no remaining references to `Mountain` anywhere in `src/`.

Run: `grep -rn "Mountain" "src/app/(app)/lo-trinh-ielts/"`
Expected: no matches.

- [ ] **Step 5: Run the full Summit unit test suite (regression check)**

Run: `npx vitest run tests/unit/ielts/`
Expected: PASS — all existing tests (engine, pricing, reducer, PDF, review-edits, etc.) stay green, confirming the layout restructure didn't break any pure-logic coverage.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/lo-trinh-ielts/StageDrawer.tsx" "src/app/(app)/lo-trinh-ielts/Summit.tsx"
git commit -m "feat(ielts): restructure Summit shell around full-bleed Racecourse + stage drawer"
```

---

### Task 7: Thread discount into ReviewSend + PDF

**Files:**
- Modify: `src/app/(app)/lo-trinh-ielts/ReviewSend.tsx`
- Modify: `src/app/(app)/lo-trinh-ielts/Summit.tsx` (pass `state.discount` to `ReviewSend`)
- Modify: `src/lib/ielts/pdf/SummitDocument.tsx`
- Test: `tests/unit/ielts/summit-pdf.test.tsx` (add discount rendering assertion)

**Interfaces:**
- Consumes: `applyDiscount` (Task 1).
- Produces: `ReviewSend` gains a new prop `discount: DiscountInput | null`; sends `applyDiscount(roadmap.totalPrice.amount, discount).net` as the archived `totalPrice` (schema already accepts any non-negative int — no schema change needed); `SummitDocument` gains an optional `totalPriceBreakdown?: PriceBreakdown` prop rendered on the cover.

**Note on testing:** `tests/unit/ielts/summit-pdf.test.tsx` already exists and uses `renderToBuffer` from `@react-pdf/renderer`, asserting on the binary `%PDF` header and buffer length — it does NOT render to searchable text, so a new test here can only prove the document still renders as a valid, non-empty PDF with the new prop present. It cannot assert the discount text actually appears without a PDF-text-extraction step this repo doesn't have; that visual confirmation happens in Task 8's manual walkthrough (Step 3.5).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/ielts/summit-pdf.test.tsx`, following the file's existing pattern exactly (same `req()` helper, same `meta` fixture already defined at the top of the file):

```tsx
it("renders a valid PDF when a discount breakdown is passed", async () => {
  const roadmap = generateSummitRoadmap(req(), "default", "2026-07-17");
  const view = toDocumentView(roadmap);
  const breakdown = applyDiscount(view.totalPrice.amount, { type: "percent", value: 10 });
  const buffer = await renderToBuffer(
    <SummitDocument view={view} meta={meta} totalPriceBreakdown={breakdown} />,
  );
  expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  expect(buffer.length).toBeGreaterThan(1000);
}, 30_000);
```

Add the import at the top of the file: `import { applyDiscount } from "@/lib/domain/ielts/pricing-discount";`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ielts/summit-pdf.test.tsx`
Expected: FAIL — TypeScript error, `SummitDocument` doesn't accept a `totalPriceBreakdown` prop yet.

- [ ] **Step 3: Modify `SummitDocument.tsx`**

Add the import:

```tsx
import type { PriceBreakdown } from "@/lib/domain/ielts/pricing-discount";
```

Add a new style to the `s` StyleSheet (after `coverName`):

```ts
  coverPrice: { fontSize: 13, marginTop: 6 },
  coverPriceGross: { fontSize: 10, textDecoration: "line-through", opacity: 0.75 },
```

Change the component signature:

```tsx
export function SummitDocument({
  view,
  meta,
  totalPriceBreakdown,
}: {
  view: SummitDocumentView;
  meta: SummitPdfMeta;
  totalPriceBreakdown?: PriceBreakdown;
}) {
```

Add a price block to the cover `<View style={s.cover}>`, right after the existing duration `<Text>` block and before the `{treatment && (...)}` block:

```tsx
          {totalPriceBreakdown && (
            <Text style={s.coverName}>
              {totalPriceBreakdown.hasDiscount && (
                <Text style={s.coverPriceGross}>{formatVnd(totalPriceBreakdown.gross)}  </Text>
              )}
              {SUMMIT_COPY.totalPriceLabel}: {formatVnd(totalPriceBreakdown.net)}
              {totalPriceBreakdown.hasDiscount
                ? ` (${SUMMIT_COPY.discount.offLabel} ${formatVnd(totalPriceBreakdown.off)})`
                : ""}
            </Text>
          )}
```

- [ ] **Step 4: Modify `ReviewSend.tsx`**

Add the import:

```tsx
import { applyDiscount, type DiscountInput } from "@/lib/domain/ielts/pricing-discount";
```

Add `discount` to `Props`:

```tsx
type Props = {
  roadmap: SummitRoadmap;
  consultant: ConsultantInfo;
  discount: DiscountInput | null;
  onBack: () => void;
  onDocumentPrepared: () => void;
  onSent: () => void;
};
```

Update the function signature:

```tsx
export function ReviewSend({ roadmap, consultant, discount, onBack, onDocumentPrepared, onSent }: Props) {
```

After the existing `const reviewed = useMemo(...)` line, add:

```tsx
  const breakdown = applyDiscount(reviewed.totalPrice.amount, discount);
```

In `buildPdfBlob`, change:

```tsx
    return pdf(<SummitDocument view={view} meta={meta} />).toBlob();
```

to:

```tsx
    return pdf(<SummitDocument view={view} meta={meta} totalPriceBreakdown={breakdown} />).toBlob();
```

In `handleSend`, change:

```tsx
        totalPrice: reviewed.totalPrice.amount,
```

to:

```tsx
        totalPrice: breakdown.net,
```

(This is the only line that determines what's archived/emailed as the final price — switching it to `breakdown.net` means a discount applied during the live presentation is honored all the way through to the sent document and archive record, with zero schema changes since `sendSummitRoadmapSchema.totalPrice` already accepts any non-negative int.)

Also update the per-stage price display (`formatVnd(stage.price ?? 0)` in the `climb.map` block) to stay as-is — per-stage prices are NOT discounted individually, only the grand total is; this matches the prototype's own `priceBreakdown()` which discounts the total, not each line.

- [ ] **Step 5: Wire `discount` prop through from `Summit.tsx`**

In `Summit.tsx`, find:

```tsx
        <ReviewSend
          roadmap={roadmap}
          consultant={consultant}
          onBack={() => dispatch({ type: "exitReview" })}
```

Add `discount={state.discount}` as a new prop:

```tsx
        <ReviewSend
          roadmap={roadmap}
          consultant={consultant}
          discount={state.discount}
          onBack={() => dispatch({ type: "exitReview" })}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/ielts/summit-pdf.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full Summit + PDF test suite**

Run: `npx vitest run tests/unit/ielts/`
Expected: PASS — all existing Summit-related tests (engine, pricing, PDF, UI, review-edits, etc.) stay green, confirming the discount threading didn't disturb the pure engine or archive contract.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/lo-trinh-ielts/ReviewSend.tsx" "src/app/(app)/lo-trinh-ielts/Summit.tsx" src/lib/ielts/pdf/SummitDocument.tsx tests/unit/ielts/summit-pdf.test.tsx
git commit -m "feat(ielts): thread discount total through ReviewSend, send/archive, and PDF cover"
```

---

### Task 8: Full-run verification + orphaned-code cleanup flag

**Files:**
- None modified (verification only) — optionally remove orphaned slice-002 files if user confirms (see Step 4).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all tests pass, including integration tests (requires local Supabase running — `npm run db:start` first if not already up).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual walkthrough**

Run: `npm run dev`, open `http://localhost:3000/lo-trinh-ielts` (log in as a consultant/manager role first per the app's auth flow), then:
1. Enter a student name, set current band 4.5 and target band 6.5 — confirm the racecourse renders the correct illuminated checkpoints left-to-right.
2. Click a checkpoint mid-climb — confirm the stage drawer slides in from the right showing that stage's narrative, price, and composition; confirm the racecourse stays visible behind/beside it.
3. Switch to the Summary rail tab — confirm total sessions/duration/finish/price render, then click the 10% discount chip — confirm the price updates to show gross (struck through) + net.
4. Toggle to Mode B (estimated placement, no test date) — confirm the racecourse's start checkpoint shows the distinct provisional badge (dashed border, "?" icon, `SUMMIT_COPY.provisionalMarker` text) — same visual contract as before, just on the new shape.
5. Enter Review & Send — confirm the PDF preview area (or generate + open the downloaded PDF) shows the cover with gross/discount/net breakdown when a discount is active, and shows the plain total when it isn't.
6. Send with a valid test-recipient email — confirm success message and that `totalPrice` recorded in the archive equals the discounted net (spot-check via Supabase Studio or `mcp__supabase__execute_sql` if available: `select total_price from summit_sends order by created_at desc limit 1;` — adjust table name to whatever `send-summit-roadmap.ts`'s archive insert actually targets).
7. Confirm resetting the session (`SUMMIT_COPY.resetButton`) clears the discount along with everything else.

- [ ] **Step 4: Flag orphaned slice-002 components (do not delete without explicit confirmation)**

`src/app/(app)/lo-trinh-ielts/RoadmapForm.tsx`, `RoadmapReview.tsx`, and `RoadmapBuilder.tsx` are leftover from the earlier 002 roadmap-builder slice and are not imported by `page.tsx` or any file touched in this plan (confirmed via `grep -rn "RoadmapBuilder\|RoadmapForm\|RoadmapReview" src/` returning only self-references among those three files). They are out of scope for this redesign. Report this finding to the user after Task 8 completes; do not delete them as part of this plan unless the user explicitly asks.

- [ ] **Step 5: Final commit (if Step 3's manual walkthrough required any fixups)**

```bash
git add -A
git commit -m "fix(ielts): address manual walkthrough findings from racecourse redesign"
```

(Skip this commit entirely if the walkthrough found no issues.)
