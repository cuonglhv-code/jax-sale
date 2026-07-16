import { describe, it, expect } from "vitest";
import { generateRoadmap } from "@/services/ielts/roadmap-engine";
import type { RoadmapRequest } from "@/services/ielts/types";

function req(overrides: Partial<RoadmapRequest>): RoadmapRequest {
  return {
    studentName: "T", audience: "SINH_VIEN", studentEmail: "t@e.com", studentPhone: null,
    currentBand: "2.5", targetBand: "6.0", examPurpose: "KHAC", targetExamDate: null,
    intensity: "TIEU_CHUAN", consultantName: "C", consultantPhone: null, consultantEmail: null,
    centreId: "x", startDate: "2026-01-01", ...overrides,
  };
}

/** US4 (T022) — deadline feasibility warning (AC-4.1/4.3), consultant-only. */
describe("engine: deadline feasibility warning", () => {
  it("raises a warning when projected completion is later than the exam date", () => {
    // Long path, very near exam date → completion will overrun.
    const r = generateRoadmap(req({ currentBand: "2.5", targetBand: "6.5", targetExamDate: "2026-03-01" }));
    expect(r.internalWarning).not.toBeNull();
    expect(r.internalWarning?.kind).toBe("deadline");
    expect(r.internalWarning?.recommend).toBe("intensive"); // was TIEU_CHUAN
  });

  it("raises NO warning when no exam date is provided (AC-4.3)", () => {
    const r = generateRoadmap(req({ targetExamDate: null }));
    expect(r.internalWarning).toBeNull();
  });

  it("raises no warning when the exam date is comfortably after completion", () => {
    const r = generateRoadmap(req({ currentBand: "6.0", targetBand: "6.5", targetExamDate: "2030-01-01" }));
    expect(r.internalWarning).toBeNull();
  });
});
