# Contract: Attainment & Rollup Engine (`src/services/kpi/`)

Pure, DB/UI-free, exhaustively unit-tested. The only place `actual`, `target`, and approval combine
into a displayed state. Enforces "NULL target ⇒ not_set, never 0%" and "approved-only" structurally.

## `attainment.ts`

```ts
/**
 * Classify one metric's attainment. `approvedActual` is already the sum of APPROVED actuals in scope
 * (pending/rejected excluded upstream). A null target yields `not_set` with ratio null — NEVER 0%.
 */
export function classifyAttainment(approvedActual: number, target: number | null): Attainment;
```

Rules (each a unit test):
- `target === null` → `{ ratio: null, state: "not_set" }` — no division, never `0`.
- `target > 0 && approvedActual >= target` → `state: "on_track"`, `ratio = approvedActual / target`.
- `target > 0 && approvedActual > 0 && approvedActual < target` → `state: "behind"`.
- `target > 0 && approvedActual === 0` → `state: "no_result"` (meaningful 0 vs `not_set`).
- Invariant test: for all inputs, `state === "not_set"` **iff** `target === null`; `ratio` is `null`
  **iff** `target === null` (SC-002).

## `rollup.ts`

```ts
/** Sum approved actuals + resolve target across a set of rows already scoped to the caller's tier. */
export function rollupAttainment(rows: PersonalKpiEntry[], metricKey: MetricKey): Attainment;
/** Sum member-month attainments into a quarter/year figure (D-PERIOD). */
export function rollupPeriods(monthly: Attainment[]): Attainment;
/** Stable leaderboard ordering: approvedActual desc, then name asc (deterministic tie-break, AC-4.4). */
export function rankLeaderboard(entries: LeaderboardEntry[]): RankedEntry[];
```

Rules (each a unit test):
- `rollupAttainment` sums only `approvalStatus === "approved"` rows (approved-only, SC-009); a set of
  all-pending rows yields `approvedActual = 0`.
- department/centre/network rollups never see rows outside the caller's tier (inputs come from
  RLS-scoped reads), so the engine cannot leak cross-tier data even if misused.
- `rankLeaderboard` is a pure total order — ties broken by name, so tests are deterministic.
- `rollupPeriods` over three months equals the sum of their approved actuals; a `not_set` member
  keeps the rollup `not_set` only if **no** member has a target (else target = sum of present
  targets).

## Boundaries

- No `Date.now()` inside pure functions that must be deterministic — the "current period" is resolved
  at the UI/action edge and passed in (keeps rollup tests time-independent).
- No Supabase/React imports in this folder — enforced by keeping it under `src/services/kpi/` with
  only `@/lib/data/types` imports.
