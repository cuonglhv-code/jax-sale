/**
 * Pure attainment classification (slice #003 — ⚙ no DB/UI/network). The ONLY place `approvedActual`,
 * `target`, and the classification combine. Enforces "NULL target ⇒ not_set, never 0%" structurally:
 * a null target yields ratio `null` and state `not_set` — no division ever happens.
 *
 * `approvedActual` is assumed to already be the sum of APPROVED actuals in scope (pending/rejected
 * excluded upstream — see rollup.ts and the RLS-invoker aggregation functions).
 */

import type { Attainment, AttainmentState, MetricKey } from "@/lib/data/types";

export function classifyAttainment(
  metricKey: MetricKey,
  approvedActual: number,
  target: number | null,
): Attainment {
  if (target === null) {
    // NULL target ⇒ not_set. Never 0%: no ratio is computed (constitution §13, SC-002).
    return { metricKey, approvedActual, target: null, ratio: null, state: "not_set" };
  }
  const ratio = approvedActual / target;
  let state: AttainmentState;
  if (approvedActual === 0) {
    state = "no_result"; // target set but no (approved) result — meaningful 0, distinct from not_set
  } else if (approvedActual >= target) {
    state = "on_track";
  } else {
    state = "behind";
  }
  return { metricKey, approvedActual, target, ratio, state };
}
