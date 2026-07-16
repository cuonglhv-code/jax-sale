# Quickstart Validation: Jaxtina IELTS Summit

Runnable scenarios proving the feature end to end. Contracts: [summit-engine](./contracts/summit-engine.md),
[presentation](./contracts/presentation.md), [delivery-archive](./contracts/delivery-archive.md),
[content-data](./contracts/content-data.md). Data shapes: [data-model.md](./data-model.md).

## Prerequisites

```powershell
npm install
npm run db:start          # local Supabase (archive tests only)
npm run db:reset          # apply migrations incl. summit_sends + storage bucket
npm run dev               # http://localhost:3000/lo-trinh-ielts
```

Env (validated at startup): Supabase keys (existing) + email provider key and sender address
(send step only — the app must boot and present WITHOUT these when offline).

## Scenario 1 — The climb (Story 1, SC-002/SC-004)

1. Open `/lo-trinh-ielts`, sign in, enter name "Minh Anh", current 4.5, target 7.0, Mode A.
2. **Expect**: mountain bottom-to-top; B2→A1→A2→A3 illuminated + Luyện đề Intensive appended;
   stages below dimmed; summary shows total buổi (28×4+16=128), duration as a range, projected
   finish window, total price = arithmetic sum of those 5 stages for the centre's price list.
3. Open each stage: exactly one expands at a time; Booster/Achiever show 4 blocks + 3-row
   progression table; change target to 6.0 mid-flow → instant re-illumination, no data loss.
4. `npm run test` → engine suite green, including the exhaustive all-band-pairs contiguity
   property (zero skipped levels).

## Scenario 2 — Provisional is unmistakable (Story 2, SC-007)

1. Same bands, Mode B (chưa test đầu vào).
2. **Expect**: distinct provisional start marker; visible caveat "Lộ trình dự kiến — cần xác
   nhận bằng kết quả test đầu vào"; duration/price framed as estimates; book-a-test CTA.
3. Generate the PDF from review: cover carries the caveat prominently. Attempt to find any
   path to a confirmed-looking Mode B output — none may exist (unit tests assert the renderer
   branches on the Placement union; there is no bypass prop).
4. Record a placement result → Mode A everywhere at once.

## Scenario 3 — Offline presentation (Constitution V, SC-006)

1. Load the app once online, sign in. Then disable ALL network (OS-level or DevTools offline).
2. Walk Scenario 1 + 2 fully, including PDF generation in review.
3. **Expect**: zero failures, zero spinners waiting on network; every view identical.
4. Attempt send while offline: loud Vietnamese failure, PDF blob + all fields preserved,
   download fallback offered; re-enable network, retry succeeds with NO re-entry.
5. Cold start check: close the tab, still offline, reopen `/lo-trinh-ielts` → the service
   worker serves the shell; presentation works.

## Scenario 4 — Send + archive (Story 3, SC-001/SC-003)

1. From a reviewed roadmap: edit one narrative block inline, add Ghi chú, remove one course
   (expect the departs-from-standard-ladder warning), fill capture, send.
2. **Expect**: email arrives with PDF; PDF sections in spec order; content identical to the
   review screen (SC-003).
3. Verify archive: `summit_sends` has one row (placement kind, bands, total, ladder_edited =
   true, pdf_path); the stored object is byte-identical to the received attachment.
4. Send again with the same generationKey (simulate retry) → still exactly one row/object.
5. Reset → warns only if unsent; after confirm, blank state, no PII visible.
6. `npm run test` integration suite: permission-gate rejection, centre isolation (A cannot
   write B), failure injection (provider error → `{ error }`, no delivered row).

## Scenario 5 — Thresholds, proof, FAQ (Stories 4–5, SC-005)

1. Open Cam kết đầu ra & điều kiện from any state (one action).
2. **Expect** verbatim, separately: Chứng nhận hoàn thành khóa học (Overall ≥ band đầu ra,
   chuyên cần ≥ 90%, bài tập ≥ 90%) and Cam kết đầu ra bằng văn bản (bài tập ≥ 95%, vắng ≤ 1
   buổi/khóa). Same in the PDF. Unit test pins both to `thresholds.ts`.
3. Summit proof: with a consented 4.5→7.0 record in `proof.ts`, it surfaces first for that
   climb; flip its consent to `written: false` → it becomes unrenderable everywhere (and the
   type test proves unconsented data cannot reach the proof components).
4. FAQ: parent objection → chip → answer in one action; back in one action.

## Scenario 6 — Content edit test (Constitution VII, SC-009)

1. Change one price in `pricing.ts`, one FAQ answer in `faq.ts`, one narrative line.
2. **Expect**: `npm run typecheck && npm run test` green with zero component/service diffs;
   the UI and PDF reflect all three changes.

## Scenario 7 — Diacritics & brand (FR-028/029)

- Visual pass at every used weight/size (screen + PDF): full Vietnamese diacritics, no tofu,
  no fallback-font mixing. Montserrat everywhere; Sansita only in the tagline lockup asset.
- Grep gate: the string "Olympia" appears nowhere in `src/` or content data.

## Definition of done for the feature

All 7 scenarios pass; `npm run test:cov` ≥ 80%; engine property tests exhaustive over band
pairs; no console errors; Constitution Check re-verified against the implementation.
