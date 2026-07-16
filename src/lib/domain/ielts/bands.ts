/**
 * Band scale for the IELTS ladder (content data — spec data-model "Band scale"). The ordered index
 * is what makes the no-skip rule and all target/output comparisons checkable. `below A1` and `~A1`
 * are pseudo-bands that order below `2.5`.
 */

export const BANDS = [
  "below A1",
  "~A1",
  "2.5",
  "3.5",
  "4.5",
  "5.5",
  "6.0",
  "6.5",
  "7.0",
  "7.5",
  "8.0+",
] as const;
export type Band = (typeof BANDS)[number];

/** Total order used for every band comparison (no-skip slicing, append rule, feasibility). */
export function bandValue(band: Band): number {
  return BANDS.indexOf(band);
}

/** Current-band input options (lowest selectable is `~A1`, labelled "Chưa có nền ~A1"). */
export const CURRENT_BAND_OPTIONS: readonly Band[] = [
  "~A1",
  "2.5",
  "3.5",
  "4.5",
  "5.5",
  "6.0",
  "6.5",
  "7.0",
];

/** Target-band input options. */
export const TARGET_BAND_OPTIONS: readonly Band[] = [
  "2.5",
  "3.5",
  "4.5",
  "5.5",
  "6.0",
  "6.5",
  "7.0",
  "7.5",
  "8.0+",
];

/** Study-intensity rates (sessions/week). ⚠ TANG_CUONG rate pending academic confirmation. */
export const STANDARD_RATE = 2.7;
export const INTENSIVE_RATE = 4; // ⚠ research D-INT — confirm with academic team
export const WEEKS_PER_MONTH = 4.33;

/** Band at/above which the A3 rung is auto-included (policy (i) — ⚠ research D-A3). */
export const A3_INCLUSION_BAND: Band = "6.5";
