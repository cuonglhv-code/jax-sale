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
   `bandGap(targetBand, finalRungOutput) ≤ 0.5`. Exactly once.
3. **Stage states**: every ladder course gets `state`: `climb` for the slice(+INT), `below` for
   rungs under the start, `above` for rungs over the end. GP never appears (out of scope).
4. **Degenerate inputs**: `targetBand ≤ currentBand` → throws `SummitInputError` (UI catches,
   prompts adjustment, preserves inputs). Current band at/above ladder top → `SummitInputError`
   with the consultant-facing Vietnamese message (never an empty silent climb).
5. **Pricing**: per-stage price from `PRICES[centreKey]`; total per data-model invariant
   (arithmetic sum; `excludesUnpriced` flag; no discount logic).
6. **Timeline (FR-004)**: totalSessions over climb stages with non-null sessions;
   `weeks = sessions / 2.7`; `months = weeks / 4.33`; returned as a min–max range (range policy:
   ±1 session/week tolerance band, i.e. min at 3.0/wk nominal, max at 2.4/wk — constants in
   content data, single-sourced). PRE_S contributes no sessions; if in climb, summary carries
   the explicit flexible-duration note.
7. **Mode carriage**: `placement` passes through untouched — the engine never renders, but every
   output object carries the union so downstream rendering cannot drop it.

### Tests (required, exhaustive)

- Every valid (current, target) pair × placement kind: climb is contiguous; INT rule holds;
  never empty-and-silent; totals match hand-computed sums (SC-004).
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
