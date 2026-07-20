import { describe, it, expect } from "vitest";
import { countWorkingDays } from "@/lib/hr/working-days";
import { annualLeaveSchema } from "@/schemas/hr/submit";

/** US1 (T015): pure working-days counting (data-model FR-015) + the annual-leave submit schema. */

const MON_FRI = [1, 2, 3, 4, 5];

describe("hr: countWorkingDays", () => {
  it("counts a full Mon–Fri working week", () => {
    // 2026-09-14 is a Monday, 2026-09-18 a Friday.
    expect(countWorkingDays({ start: "2026-09-14", end: "2026-09-18", workingWeek: MON_FRI })).toBe(5);
  });

  it("excludes weekends", () => {
    // Mon 2026-09-14 .. Sun 2026-09-20 — one full calendar week, still 5 working days.
    expect(countWorkingDays({ start: "2026-09-14", end: "2026-09-20", workingWeek: MON_FRI })).toBe(5);
  });

  it("excludes configured holidays", () => {
    expect(
      countWorkingDays({
        start: "2026-09-14",
        end: "2026-09-18",
        workingWeek: MON_FRI,
        holidays: ["2026-09-16"],
      }),
    ).toBe(4);
  });

  it("counts a half-day (morning/afternoon) as 0.5", () => {
    expect(
      countWorkingDays({ start: "2026-09-14", end: "2026-09-14", workingWeek: MON_FRI, dayPart: "morning" }),
    ).toBe(0.5);
  });

  it("returns 0 for an invalid range (end before start)", () => {
    expect(countWorkingDays({ start: "2026-09-18", end: "2026-09-14", workingWeek: MON_FRI })).toBe(0);
  });

  it("returns 0 when the whole range falls on non-working days", () => {
    // Sat 2026-09-19 .. Sun 2026-09-20.
    expect(countWorkingDays({ start: "2026-09-19", end: "2026-09-20", workingWeek: MON_FRI })).toBe(0);
  });
});

describe("hr: annual-leave submit schema", () => {
  const base = {
    requestType: "annual_leave" as const,
    startDate: "2026-09-14",
    endDate: "2026-09-15",
    dayPart: "full" as const,
  };

  it("accepts a valid range", () => {
    expect(() => annualLeaveSchema.parse(base)).not.toThrow();
  });

  it("defaults dayPart to full when omitted", () => {
    const { dayPart: _dayPart, ...rest } = base;
    const parsed = annualLeaveSchema.parse(rest);
    expect(parsed.dayPart).toBe("full");
  });

  it("rejects an end date before the start date", () => {
    expect(() => annualLeaveSchema.parse({ ...base, endDate: "2026-09-13" })).toThrow();
  });

  it("rejects an invalid day_part value", () => {
    expect(() => annualLeaveSchema.parse({ ...base, dayPart: "evening" })).toThrow();
  });

  it("rejects a missing start date", () => {
    expect(() => annualLeaveSchema.parse({ ...base, startDate: "" })).toThrow();
  });
});
