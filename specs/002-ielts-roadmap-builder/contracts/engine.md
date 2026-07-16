# Contract: Roadmap engine + PDF input boundary

## Engine (pure ⚙)

```ts
// src/services/ielts/roadmap-engine.ts
export function generateRoadmap(request: RoadmapRequest, ladder: Course[]): Roadmap;
```

- **Pure**: deterministic function of `(request, ladder)`; no DB, UI, network, clock-beyond-startDate,
  or randomness. Independently unit-testable (constitution Principle IV; FR-ENGINE-05).
- **No-skip guarantee (FR-ENGINE-01, SC-002)**: the returned `courses` rungs form a **contiguous**
  sub-array of the ladder rungs — asserted by tests across all entry/target pairs.
- Applies audience overrides (Mất gốc→PRE_S, THCS→GP-before-B1), A3 policy (i), INT auto-append, and
  timeline maths per [data-model.md](../data-model.md).
- Returns a well-formed `Roadmap` for every schema-valid request (never throws for valid input; edge
  inputs return a defined shape with a consultant-only note).

## The internal-only barrier (SC-006 — structural, compile-time)

```ts
// The PDF document accepts a type that STRUCTURALLY cannot carry the internal warning:
export type StudentRoadmapView = Omit<Roadmap, "internalWarning" | "consultantNotesInternal">;

// RoadmapDocument only accepts StudentRoadmapView — the deadline warning field does not exist on it,
// so it is a COMPILE ERROR to pass the warning into the PDF. Not a runtime check that can be forgotten.
export function toStudentView(r: Roadmap): StudentRoadmapView;   // drops internal-only fields
```

- A test asserts `StudentRoadmapView` has no `internalWarning` field (type-level) and that
  `RoadmapDocument`'s prop type is `StudentRoadmapView`, making AC-4.2 structurally enforced.

## Content dependency

- The engine reads the ladder + session counts from `courses.ts`; narrative copy is materialized
  from the content store by `narrativeKey`. Changing copy or a session count is a content edit — no
  engine change (FR-CONTENT-01). GP's provisional session count flows through as
  `sessionsProvisional`.
