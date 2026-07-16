/**
 * Period model (slice #003, D-PERIOD): a period is a calendar month "YYYY-MM". Quarter and year are
 * DERIVED rollups (sums of member months), never separately entered. Pure, dependency-free.
 */

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isPeriod(value: string): boolean {
  return PERIOD_RE.test(value);
}

export function parsePeriod(value: string): { year: number; month: number } {
  const m = PERIOD_RE.exec(value);
  if (!m) throw new Error(`Kỳ không hợp lệ: ${value}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function formatPeriod(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Quarter (1–4) containing `period`. */
export function quarterOf(period: string): number {
  const { month } = parsePeriod(period);
  return Math.floor((month - 1) / 3) + 1;
}

/** The 3 member months of a quarter (1–4), ascending. */
export function monthsOfQuarter(year: number, quarter: number): string[] {
  if (quarter < 1 || quarter > 4) throw new Error(`Quý không hợp lệ: ${quarter}`);
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2].map((mo) => formatPeriod(year, mo));
}

/** The 12 member months of a year, ascending. */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => formatPeriod(year, i + 1));
}
