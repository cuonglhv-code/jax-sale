import { describe, it, expect } from "vitest";
import { resolveAffectedSessions, type ConflictClass } from "@/lib/hr/conflict";

/**
 * US4 (T038): pure conflict resolver (data-model §4/§11, contracts/cover-timetable.actions.md).
 * No DB access — classes/holidays/AM-PM boundary are all passed in by the caller. Covers: overlap,
 * out-of-recurrence-window exclusion, holiday exclusion, half-day AM/PM, inactive-class exclusion,
 * different-teacher exclusion.
 */

const MONDAY_CLASS: ConflictClass = {
  id: "class-mon",
  centreId: "centre-1",
  teacherId: "teacher-1",
  weekday: 1, // Monday
  startTime: "18:00",
  endTime: "20:00",
  startDate: "2026-01-05",
  endDate: "2026-12-20",
  isActive: true,
};

const MORNING_CLASS: ConflictClass = {
  id: "class-morning",
  centreId: "centre-1",
  teacherId: "teacher-1",
  weekday: 3, // Wednesday
  startTime: "08:00",
  endTime: "10:00",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  isActive: true,
};

const AFTERNOON_CLASS: ConflictClass = {
  ...MORNING_CLASS,
  id: "class-afternoon",
  startTime: "14:00",
  endTime: "16:00",
};

describe("hr: resolveAffectedSessions", () => {
  it("emits a session when the leave range covers the class's recurring weekday", () => {
    // 2026-09-14 (Mon) .. 2026-09-20 (Sun) — one Monday session inside range.
    const sessions = resolveAffectedSessions({
      classes: [MONDAY_CLASS],
      teacherId: "teacher-1",
      startDate: "2026-09-14",
      endDate: "2026-09-20",
      dayPart: "full",
      holidays: [],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ classId: "class-mon", sessionDate: "2026-09-14" });
  });

  it("emits one session per occurrence across multiple weeks", () => {
    // Two Mondays: 2026-09-14 and 2026-09-21.
    const sessions = resolveAffectedSessions({
      classes: [MONDAY_CLASS],
      teacherId: "teacher-1",
      startDate: "2026-09-14",
      endDate: "2026-09-21",
      dayPart: "full",
      holidays: [],
    });
    expect(sessions.map((s) => s.sessionDate)).toEqual(["2026-09-14", "2026-09-21"]);
  });

  it("excludes a session outside [class.start_date, class.end_date]", () => {
    const classEndingEarly: ConflictClass = { ...MONDAY_CLASS, endDate: "2026-09-14" };
    const sessions = resolveAffectedSessions({
      classes: [classEndingEarly],
      teacherId: "teacher-1",
      startDate: "2026-09-14",
      endDate: "2026-09-21",
      dayPart: "full",
      holidays: [],
    });
    // Only the 09-14 occurrence is within the recurrence window; 09-21 is past class.endDate.
    expect(sessions.map((s) => s.sessionDate)).toEqual(["2026-09-14"]);
  });

  it("excludes a date that falls on a public holiday", () => {
    const sessions = resolveAffectedSessions({
      classes: [MONDAY_CLASS],
      teacherId: "teacher-1",
      startDate: "2026-09-14",
      endDate: "2026-09-14",
      dayPart: "full",
      holidays: ["2026-09-14"],
    });
    expect(sessions).toHaveLength(0);
  });

  it("excludes an inactive class", () => {
    const inactive: ConflictClass = { ...MONDAY_CLASS, isActive: false };
    const sessions = resolveAffectedSessions({
      classes: [inactive],
      teacherId: "teacher-1",
      startDate: "2026-09-14",
      endDate: "2026-09-14",
      dayPart: "full",
      holidays: [],
    });
    expect(sessions).toHaveLength(0);
  });

  it("excludes a class belonging to a different teacher", () => {
    const sessions = resolveAffectedSessions({
      classes: [MONDAY_CLASS],
      teacherId: "someone-else",
      startDate: "2026-09-14",
      endDate: "2026-09-14",
      dayPart: "full",
      holidays: [],
    });
    expect(sessions).toHaveLength(0);
  });

  it("full day part matches both a morning and an afternoon session", () => {
    const sessions = resolveAffectedSessions({
      classes: [MORNING_CLASS, AFTERNOON_CLASS],
      teacherId: "teacher-1",
      startDate: "2026-09-16", // Wednesday
      endDate: "2026-09-16",
      dayPart: "full",
      holidays: [],
    });
    expect(sessions).toHaveLength(2);
  });

  it("morning day part matches only sessions before the AM/PM boundary", () => {
    const sessions = resolveAffectedSessions({
      classes: [MORNING_CLASS, AFTERNOON_CLASS],
      teacherId: "teacher-1",
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dayPart: "morning",
      holidays: [],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].classId).toBe("class-morning");
  });

  it("afternoon day part matches only sessions at/after the AM/PM boundary", () => {
    const sessions = resolveAffectedSessions({
      classes: [MORNING_CLASS, AFTERNOON_CLASS],
      teacherId: "teacher-1",
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dayPart: "afternoon",
      holidays: [],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].classId).toBe("class-afternoon");
  });

  it("respects a configurable AM/PM boundary (not hardcoded noon)", () => {
    // A class starting at 13:00 is normally "afternoon" under a noon boundary, but with a 14:00
    // boundary configured, a 13:00 start now counts as morning.
    const earlyAfternoonClass: ConflictClass = { ...MORNING_CLASS, startTime: "13:00", endTime: "15:00" };
    const morningWithLateBoundary = resolveAffectedSessions({
      classes: [earlyAfternoonClass],
      teacherId: "teacher-1",
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dayPart: "morning",
      holidays: [],
      amPmBoundary: "14:00",
    });
    expect(morningWithLateBoundary).toHaveLength(1);

    const afternoonWithLateBoundary = resolveAffectedSessions({
      classes: [earlyAfternoonClass],
      teacherId: "teacher-1",
      startDate: "2026-09-16",
      endDate: "2026-09-16",
      dayPart: "afternoon",
      holidays: [],
      amPmBoundary: "14:00",
    });
    expect(afternoonWithLateBoundary).toHaveLength(0);
  });
});
