/**
 * Pure annual-leave entitlement calculation (HR slice #004, FR-009/046; data-model §8/§11). No DB
 * access — every input (policy figures, hire date, employment type) is passed in, so this is fully
 * unit-testable. Mirrored in SQL inside `recompute_entitlement`
 * (supabase/migrations/20260717130005_hr_fn_balance.sql) since Postgres functions cannot call out to
 * TS — keep both in sync when the formula changes (documented at both call sites).
 *
 * Formula: `annualBaselineDays` + seniority accrual (`floor(fullYearsOfService / seniorityYearsStep)
 * * seniorityExtraDaysPerYears`, years of service counted as full years completed BEFORE the leave
 * year starts), pro-rated for a mid-year hire (completed months worked within the hire year, hire
 * month inclusive — the common Vietnamese Labour Code first-year practice: 12 days/year ⇒ 1
 * day/month worked), then pro-rated again for part-time employment when the policy opts in.
 */

import type { EmploymentType } from "@/lib/data/types";

const MONTHS_PER_YEAR = 12;
/**
 * Documented assumption: the schema has no per-employee FTE fraction, so a part-time employee
 * accrues at a flat half rate when `partTimeProrate` is enabled (data-model FR-046). Flag to the
 * reviewing lead — a future slice may need a real FTE fraction instead of this fixed factor.
 */
const PART_TIME_FACTOR = 0.5;

export interface EntitlementInput {
  /** ISO date (YYYY-MM-DD). */
  hireDate: string;
  employmentType: EmploymentType;
  leaveYear: number;
  annualBaselineDays: number;
  seniorityExtraDaysPerYears: number;
  seniorityYearsStep: number;
  partTimeProrate: boolean;
}

function toUtcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Full years completed between `hireDate` and `referenceDate` (anniversary-aware, never negative). */
function fullYearsBefore(hireDate: Date, referenceDate: Date): number {
  let years = referenceDate.getUTCFullYear() - hireDate.getUTCFullYear();
  const hireMonthDay = hireDate.getUTCMonth() * 100 + hireDate.getUTCDate();
  const refMonthDay = referenceDate.getUTCMonth() * 100 + referenceDate.getUTCDate();
  if (refMonthDay < hireMonthDay) years -= 1;
  return Math.max(0, years);
}

/**
 * Compute `entitlement_days` for one (employee, leave year). Returns 0 for an employee not yet
 * hired as of the leave year (hire date in a future year relative to `leaveYear`).
 */
export function computeEntitlementDays(input: EntitlementInput): number {
  const hireDate = toUtcDate(input.hireDate);
  const hireYear = hireDate.getUTCFullYear();
  if (hireYear > input.leaveYear) return 0;

  const yearStart = new Date(Date.UTC(input.leaveYear, 0, 1));
  const yearsOfService = fullYearsBefore(hireDate, yearStart);
  const seniorityDays = Math.floor(yearsOfService / input.seniorityYearsStep) * input.seniorityExtraDaysPerYears;
  let total = input.annualBaselineDays + seniorityDays;

  if (hireYear === input.leaveYear) {
    const monthsWorked = MONTHS_PER_YEAR - hireDate.getUTCMonth(); // hire month inclusive
    total = total * (monthsWorked / MONTHS_PER_YEAR);
  }

  if (input.employmentType === "part_time" && input.partTimeProrate) {
    total = total * PART_TIME_FACTOR;
  }

  return Math.round(total * 10) / 10; // one decimal place (leave_balance.entitlement_days numeric(4,1))
}
