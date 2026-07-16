# Contract: Presentation (screen) — the mountain

UI contract for `app/(app)/lo-trinh-ielts/`. This is a behaviour contract; visual design obeys
the constitution (I, VI, VIII) and `brand.ts` tokens only.

## Layout invariants

- The ladder renders bottom-to-top, always — no view, transition, or intermediate state shows
  the climb inverted (Constitution I). The PDF timeline uses the same orientation.
- Default (blank) view is legible in 3 seconds: a mountain, its stages, and — once bands are
  set — the highlighted here-to-there stretch (SC-002).
- Laptop viewport only; the default view fits without scrolling.

## State map (every edge = one user action — FR-010, SC-008)

| From \ To | mountain | stage n | summary | secondary (×3) | review |
|---|---|---|---|---|---|
| mountain | — | 1 (click stage) | 1 | 1 (rail) | 1 (rail) |
| stage n | 1 (close) | 1 (click other → swaps) | 1 | 1 | 1 |
| summary | 1 | 1 | — | 1 | 1 |
| secondary | 1 (back) | 1 | 1 | 1 (switch tab) | 1 |
| review | 1 (back) | — | — | — | — |

- Exactly one stage expanded at a time; opening one collapses the other (FR-008).
- Band/target change is available from every presentation state and re-renders immediately.
- Reset is one obvious action from everywhere; warns when a prepared document is unsent.

## Motion rules (Constitution VI)

- Nothing autoplays; no sound. Transitions animate `transform`/`opacity` only, ≤ 300ms,
  interruptible mid-flight (a second action never queues behind an animation).
- `prefers-reduced-motion` collapses all transitions to instant state swaps.
- The summit "arrival" treatment (light change, opened view) is a state style, not a timed
  sequence the consultant waits for.

## Mode rendering (Constitution III)

- Components rendering the start marker, summary, and any heading take `Placement` and switch
  exhaustively. The `estimated` branch renders: distinct provisional marker treatment, the
  literal copy "Lộ trình dự kiến — cần xác nhận bằng kết quả test đầu vào", estimate framing on
  duration and price, and the book-placement-test call to action. There is no prop combination
  that renders an estimated placement identically to a measured one.

## Stage detail shape (FR-009)

- Booster/Achiever: 4 blocks in order; "Nút thắt thật sự" visually weighted; progression table
  3 rows (Listening/Reading, Writing, Speaking) × (Progression cốt lõi, Cách hiểu đơn giản).
- Foundation: "Bạn sẽ học gì?" (4 strands) + "Mục tiêu khóa học".
- Intensive: "Đối tượng", "Mục tiêu khóa học", 3 columns NÓI / VIẾT / CHIẾN LƯỢC THI.
- All copy from narrative content modules; an inline Vietnamese string in a component is a
  review-blocking defect (Constitution VII).

## Proof surface (Constitution IX)

- Summit proof accepts only `ConsentedProof[]` (via `matchProof`). `nearest` matches render
  with framing that never claims the family's exact journey.

## Secondary content (Story 5)

- Three areas (ecosystem / commitments / FAQ) open in one action from the persistent rail and
  return in one action. Commitments render both thresholds verbatim from `thresholds.ts` — the
  component has no threshold text of its own. FAQ renders objection chips; chip → answer is one
  action.

## Review & send (Story 3)

- Review shows the document exactly as it will be sent (same `SummitRoadmap` → same renderer
  as the PDF content). Inline edits update the single source; removals/reorders set
  `manualEdited` and show the departs-from-standard-ladder warning.
- Send failure: blocking Vietnamese error, state + PDF blob retained, one-action retry and a
  download fallback. Success confirms delivery and offers reset.
