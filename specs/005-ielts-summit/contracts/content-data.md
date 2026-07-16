# Contract: Content Data (Principle VII)

Every user-facing word, number, and proof item lives in editable modules under
`src/lib/domain/ielts/`. Academic/marketing staff change content by editing these files only;
a content change that requires touching a component or service is a constitution violation.

## Existing modules (002 — reused as-is)

| Module | Owns |
|---|---|
| `bands.ts` | Band scale + rate constants (2.7/wk, 4.33 wk/mo) |
| `courses.ts` | Ladder rungs, sessions, session composition, narrative keys |
| `narrative/*` | Tier-shaped course narratives (placeholder copy of realistic length until real copy arrives) |
| `thresholds.ts` | THE two commitment thresholds — sole source, never copied |
| `ecosystem.ts` | Hệ sinh thái hỗ trợ items (incl. PRE(F)C coach, e-book library, CLB Speaking) |
| `brand.ts` | Navy #2B3A8C, red #D01F26, typography tokens, logo/mascot refs |

## New modules (005)

### `pricing.ts`

```ts
type PriceList = Partial<Record<CourseCode, number>>;  // VND, per stage
export const PRICES: Record<CentreKey, PriceList>;
export const PRICE_DISPLAY: { unpricedLabelVi: string /* "liên hệ tư vấn" */ };
```

Rules: numbers only — no discount/promo fields exist (clarified 2026-07-17); a missing course
key renders the unpriced label and excludes the stage from the total with the explicit flag.

### `proof.ts`

```ts
// internal shape (not exported):
// { id, displayName, photoRef, startBand, resultBand, quoteVi,
//   consent: { written: true, onFileRef } | { written: false } }
export const CONSENTED_PROOF: readonly ConsentedProof[];  // the ONLY renderable export
```

Rules: adding a testimonial = adding an entry; it becomes renderable only when its consent
field carries `written: true` + a reference to the document on file. No other export of proof
material may exist (Constitution IX).

### `faq.ts`

```ts
export const FAQ: readonly FaqEntry[];  // objectionKey, chipLabelVi, questionVi, answerVi, priority
```

Rules: order/priority is editorial and lives here; the component renders chips in file order.

### `summit-copy.ts`

All summit-specific UI strings: the provisional caveat ("Lộ trình dự kiến — cần xác nhận bằng
kết quả test đầu vào"), estimate framings, book-placement-test CTA, warnings (departs from
standard ladder; unsent work on reset), send success/failure messages, email subject/body
templates, summary labels. Vietnamese only; full diacritics.

## Validation

- Startup-time (test-time) Zod parse of every content module: bands referenced by proof exist;
  every climbable course has narrative; every centre key in `PRICES` is a known centre; FAQ
  keys unique. A malformed content edit fails fast in CI, not in front of a family.
- The "content edit test" (constitution workflow gate): changing a price, a narrative block,
  an FAQ answer, or a proof entry touches exactly one file under `lib/domain/ielts/`.
