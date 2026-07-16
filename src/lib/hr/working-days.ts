/**
 * Pure working-day counting for leave requests (HR slice #004, FR-015). No DB access — every input
 * (working-week, holidays) is passed in, so this is fully unit-testable. The working-week is a list
 * of ISO weekday numbers (1 = Monday … 7 = Sunday); holidays are ISO date strings excluded from the
 * count. Half-day leave (morning/afternoon) counts as 0.5 (spec: single-day granularity).
 */

import type { LeaveDayPart } from "@/lib/data/types";

const MS_PER_DAY = 86_400_000;
const HALF_DAY = 0.5;

export interface WorkingDaysInput {
  /** Inclusive range start, ISO date (YYYY-MM-DD). */
  start: string;
  /** Inclusive range end, ISO date (YYYY-MM-DD). */
  end: string;
  /** ISO weekday numbers counted as working (e.g. [1,2,3,4,5] for Mon–Fri). */
  workingWeek: readonly number[];
  /** ISO date strings excluded from the count (public holidays). */
  holidays?: readonly string[];
  /** Half-day granularity; `morning`/`afternoon` ⇒ 0.5. Defaults to a full day. */
  dayPart?: LeaveDayPart | null;
}

/** Parse a YYYY-MM-DD string to a UTC-midnight epoch (timezone-safe day arithmetic). */
function toUtcEpoch(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** ISO weekday (1 = Monday … 7 = Sunday) for a UTC epoch. */
function isoWeekday(epoch: number): number {
  const jsDay = new Date(epoch).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Count working days in the inclusive `[start, end]` range, excluding non-working weekdays and
 * holidays. A `morning`/`afternoon` day part yields 0.5 (assumes a single-day half-day request,
 * enforced at the schema layer). Returns 0 for an empty/invalid range or when no working day falls
 * inside it.
 */
export function countWorkingDays(input: WorkingDaysInput): number {
  const startEpoch = toUtcEpoch(input.start);
  const endEpoch = toUtcEpoch(input.end);
  if (Number.isNaN(startEpoch) || Number.isNaN(endEpoch) || endEpoch < startEpoch) return 0;

  const workingSet = new Set(input.workingWeek);
  const holidaySet = new Set(input.holidays ?? []);

  let count = 0;
  for (let epoch = startEpoch; epoch <= endEpoch; epoch += MS_PER_DAY) {
    if (!workingSet.has(isoWeekday(epoch))) continue;
    const iso = new Date(epoch).toISOString().slice(0, 10);
    if (holidaySet.has(iso)) continue;
    count += 1;
  }

  if (count === 0) return 0;
  if (input.dayPart === "morning" || input.dayPart === "afternoon") return HALF_DAY;
  return count;
}
