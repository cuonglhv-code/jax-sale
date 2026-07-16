/**
 * Pure rollup & ranking (slice #003 — ⚙ no DB/UI/network). Sums APPROVED actuals; targets sum across
 * the rows in scope regardless of approval (a target is set by a manager, not "approved"). Inputs are
 * always rows the caller may see (RLS-scoped upstream), so this cannot leak cross-tier data.
 */

import type { Attainment, MetricKey, PersonalKpiEntry } from "@/lib/data/types";
import { classifyAttainment } from "@/services/kpi/attainment";

export interface LeaderboardEntry {
  consultantId: string;
  name: string;
  approvedActual: number;
}
export interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

/** Aggregate a set of rows (one scope, one metric) into a single Attainment. */
export function rollupAttainment(
  rows: readonly PersonalKpiEntry[],
  metricKey: MetricKey,
): Attainment {
  const forMetric = rows.filter((r) => r.metricKey === metricKey);
  const approvedActual = forMetric
    .filter((r) => r.approvalStatus === "approved")
    .reduce((sum, r) => sum + r.actual, 0);
  const target = sumTargets(forMetric.map((r) => r.target));
  return classifyAttainment(metricKey, approvedActual, target);
}

/** Roll member-month attainments into a quarter/year figure (D-PERIOD). */
export function rollupPeriods(monthly: readonly Attainment[]): Attainment {
  if (monthly.length === 0) throw new Error("Không có kỳ để tổng hợp");
  const metricKey = monthly[0].metricKey;
  const approvedActual = monthly.reduce((sum, a) => sum + a.approvedActual, 0);
  const target = sumTargets(monthly.map((a) => a.target));
  return classifyAttainment(metricKey, approvedActual, target);
}

/** Stable total order: approvedActual desc, then name asc (deterministic tie-break, AC-4.4). */
export function rankLeaderboard(entries: readonly LeaderboardEntry[]): RankedEntry[] {
  return [...entries]
    .sort((a, b) => b.approvedActual - a.approvedActual || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** Sum present (non-null) targets; null when NONE is set, so the rollup stays not_set. */
function sumTargets(targets: readonly (number | null)[]): number | null {
  const present = targets.filter((t): t is number => t !== null);
  return present.length > 0 ? present.reduce((sum, t) => sum + t, 0) : null;
}
