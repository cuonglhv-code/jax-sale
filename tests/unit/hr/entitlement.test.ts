import { describe, it, expect } from "vitest";
import { computeEntitlementDays, type EntitlementInput } from "@/lib/hr/entitlement";

/** US3 (T023): pure entitlement compute — baseline + seniority + mid-year/part-time prorate. */

const basePolicy: Omit<EntitlementInput, "hireDate" | "employmentType" | "leaveYear"> = {
  annualBaselineDays: 12,
  seniorityExtraDaysPerYears: 1,
  seniorityYearsStep: 5,
  partTimeProrate: true,
};

describe("hr: computeEntitlementDays", () => {
  it("returns just the baseline when seniority has not reached the first step", () => {
    // Hired 2024-06-01; as of 2026-01-01 that is 1 full year of service (< step of 5).
    expect(
      computeEntitlementDays({
        ...basePolicy,
        hireDate: "2024-06-01",
        employmentType: "full_time",
        leaveYear: 2026,
      }),
    ).toBe(12);
  });

  it("adds one seniority step once the years-of-service threshold is crossed", () => {
    // Hired 2020-03-01; as of 2026-01-01 that is 5 full years of service (>= step of 5) => +1 day.
    expect(
      computeEntitlementDays({
        ...basePolicy,
        hireDate: "2020-03-01",
        employmentType: "full_time",
        leaveYear: 2026,
      }),
    ).toBe(13);
  });

  it("does not yet grant the seniority step one day before the anniversary", () => {
    // Hired 2021-01-02; as of 2026-01-01 that is only 4 full years of service (anniversary not yet
    // reached), so no seniority day is granted.
    expect(
      computeEntitlementDays({
        ...basePolicy,
        hireDate: "2021-01-02",
        employmentType: "full_time",
        leaveYear: 2026,
      }),
    ).toBe(12);
  });

  it("pro-rates a mid-year hire by completed months worked (hire month inclusive)", () => {
    // Hired 2026-04-01 (April): 9 months worked (Apr..Dec) of the 12-day baseline => 9.0.
    expect(
      computeEntitlementDays({
        ...basePolicy,
        hireDate: "2026-04-01",
        employmentType: "full_time",
        leaveYear: 2026,
      }),
    ).toBe(9);
  });

  it("pro-rates part-time employment at half rate when the policy opts in", () => {
    // Same as the seniority-step case (13.0 full-time-equivalent) halved for part-time.
    expect(
      computeEntitlementDays({
        ...basePolicy,
        hireDate: "2020-03-01",
        employmentType: "part_time",
        leaveYear: 2026,
      }),
    ).toBe(6.5);
  });

  it("does not pro-rate part-time employment when the policy disables it", () => {
    expect(
      computeEntitlementDays({
        ...basePolicy,
        partTimeProrate: false,
        hireDate: "2020-03-01",
        employmentType: "part_time",
        leaveYear: 2026,
      }),
    ).toBe(13);
  });

  it("returns 0 for an employee not yet hired as of the leave year", () => {
    expect(
      computeEntitlementDays({
        ...basePolicy,
        hireDate: "2027-01-15",
        employmentType: "full_time",
        leaveYear: 2026,
      }),
    ).toBe(0);
  });
});
