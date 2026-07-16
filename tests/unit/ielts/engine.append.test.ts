import { describe, it, expect } from "vitest";
import { generateRoadmap } from "@/services/ielts/roadmap-engine";
import type { RoadmapRequest } from "@/services/ielts/types";

function req(overrides: Partial<RoadmapRequest>): RoadmapRequest {
  return {
    studentName: "T", audience: "SINH_VIEN", studentEmail: "t@e.com", studentPhone: null,
    currentBand: "4.5", targetBand: "6.0", examPurpose: "KHAC", targetExamDate: null,
    intensity: "TIEU_CHUAN", consultantName: "C", consultantPhone: null, consultantEmail: null,
    centreId: "x", startDate: "2026-01-01", ...overrides,
  };
}

const hasInt = (r: RoadmapRequest) => generateRoadmap(r).courses.some((c) => c.code === "INT");

/** US3 (T018) — Intensive auto-append rule (AC-3.1). */
describe("engine: Intensive auto-append", () => {
  it("appends INT when target ≥ 5.5 and an exam date is set", () => {
    expect(hasInt(req({ currentBand: "2.5", targetBand: "5.5", targetExamDate: "2027-01-01" }))).toBe(true);
  });

  it("appends INT when target ≥ 5.5 and gap to final output ≤ 0.5 (no exam date)", () => {
    // target 6.0 = A1 output → gap 0 ≤ 0.5 → INT
    expect(hasInt(req({ currentBand: "5.5", targetBand: "6.0" }))).toBe(true);
  });

  it("does NOT append INT when target < 5.5", () => {
    expect(hasInt(req({ currentBand: "2.5", targetBand: "4.5" }))).toBe(false);
  });
});
