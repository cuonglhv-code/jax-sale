# Contract: Summit Engine (pure)

`src/services/ielts/summit-engine.ts` — deterministic, no DB/UI/network. Consumes the shared
ladder slice logic from 002's `roadmap-engine.ts`; never reimplements it.

## generateSummitRoadmap

```ts
function generateSummitRoadmap(
  req: SummitRequest,
  centreKey: CentreKey,
): SummitRoadmap
```

### Behaviour

1. **Slice (Constitution II)**: contiguous rung slice from the first rung whose output exceeds
   `currentBand` through the first rung whose output ≥ `targetBand`. Entry "below A1" starts at
   PRE_S. No skipping is expressible; the function cannot return a non-contiguous climb.
2. **Intensive append (FR-003)**: append INT iff `targetBand ≥ 5.5` AND
   `bandGap(targetBand, finalRungOutput) ≤ 0.5`. Exactly once. **INT-only climb** (clarified
   2026-07-17): when no rung applies but `currentBand ≥ 5.5` and `target ≤ current + 0.5`,
   the climb is `[INT]` alone — valid, never an error.
3. **Stage states**: every ladder course gets `state`: `climb` for the slice(+INT), `below` for
   rungs under the start, `above` for rungs over the end. GP never appears (out of scope).
4. **Degenerate inputs**: `targetBand ≤ currentBand` → throws `SummitInputError` (UI catches,
   prompts adjustment, preserves inputs). Target beyond A3 + INT honest reach → render the
   highest honest climb AND set `consultantAdvisory` (internal-only, excluded from the
   document view — the StudentView pattern); never an empty silent climb, never a claim the
   out-of-reach target is covered (clarified 2026-07-17).
5. **Pricing**: per-stage price from `PRICES[centreKey]`; total per data-model invariant
   (arithmetic sum; `excludesUnpriced` flag; no discount logic).
6. **Timeline (FR-004)**: totalSessions over climb stages with non-null sessions;
   `weeks = sessions / 2.7`; `months = weeks / 4.33`; returned as a min–max range over the
   2.4–3.0 effective-sessions/week pace band (min duration at 3.0/wk, max at 2.4/wk).
   Constants live in content data, single-sourced, ⏳ marked provisional pending academic
   confirmation (clarified 2026-07-17). PRE_S contributes no sessions; if in climb, summary
   carries the explicit flexible-duration note.
7. **Mode carriage**: `placement` passes through untouched — the engine never renders, but every
   output object carries the union so downstream rendering cannot drop it.

### Tests (required, exhaustive)

- Every valid (current, target) pair × placement kind: climb is contiguous; INT rule holds
  (including INT-only climbs at 5.5+); out-of-reach targets yield highest honest climb +
  consultantAdvisory; never empty-and-silent; totals match hand-computed sums (SC-004).
- Property: for all pairs, sequence of climb codes is a subarray of RUNGS codes (+ optional
  trailing INT).
- Degenerate pairs throw, with inputs recoverable.

## matchProof (pure)

```ts
function matchProof(climb: { startBand: Band; targetBand: Band }, pool: readonly ConsentedProof[]):
  ProofMatch[]   // ordered best-first; exact before nearest; never fabricates "exact"
```

Distance = |startΔ| + |resultΔ| in band-order indices. Ties break by editorial order in the
content file. Accepts only `ConsentedProof` — passing unconsented data is untypeable.
