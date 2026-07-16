/**
 * The KPI metric catalog (slice #003) — data, extensible. Vietnamese labels live in vocabulary.ts
 * (METRIC_LABEL). Enum VALUES are the contract (see types.ts METRIC_KEYS). Attainment is computed
 * identically for any metric (`approved actual / target`).
 */

import type { MetricKey } from "@/lib/data/types";

export interface MetricDef {
  key: MetricKey;
  /** `count` = integer units (e.g. enrolments); `vnd` = Vietnamese đồng (integer). */
  unit: "count" | "vnd";
}

export const METRICS: readonly MetricDef[] = [
  { key: "enrolments_closed", unit: "count" },
  { key: "revenue", unit: "vnd" },
];

export function metricUnit(key: MetricKey): MetricDef["unit"] {
  const def = METRICS.find((m) => m.key === key);
  if (!def) throw new Error(`Chỉ số không hợp lệ: ${key}`);
  return def.unit;
}
