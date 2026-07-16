import { describe, it, expect } from "vitest";
import { generateRoadmap } from "@/services/ielts/roadmap-engine";
import type { RoadmapRequest } from "@/services/ielts/types";
import type { Band } from "@/lib/domain/ielts/bands";
import type { Audience } from "@/lib/domain/ielts/labels";

function req(overrides: Partial<RoadmapRequest>): RoadmapRequest {
  return {
    studentName: "T", audience: "SINH_VIEN", studentEmail: "t@e.com", studentPhone: null,
    currentBand: "3.5" as Band, targetBand: "6.0" as Band, examPurpose: "KHAC",
    targetExamDate: null, intensity: "TIEU_CHUAN", consultantName: "C", consultantPhone: null,
    consultantEmail: null, centreId: "x", startDate: "2026-01-01", ...overrides,
  };
}

/** US3 (T017) — audience overrides (AC-3.2/3.3). */
describe("engine: audience overrides", () => {
  it("Mất gốc starts the sequence at PRE_S", () => {
    const codes = generateRoadmap(req({ audience: "MAT_GOC" as Audience, currentBand: "~A1", targetBand: "6.0" })).courses.map((c) => c.code);
    expect(codes[0]).toBe("PRE_S");
  });

  it("THCS inserts Grammar Pathway (GP) immediately before B1", () => {
    const codes = generateRoadmap(req({ audience: "THCS" as Audience, currentBand: "3.5", targetBand: "6.0" })).courses.map((c) => c.code);
    const gpPos = codes.indexOf("GP");
    const b1Pos = codes.indexOf("B1");
    expect(gpPos).toBeGreaterThanOrEqual(0);
    expect(b1Pos).toBe(gpPos + 1);
  });

  it("A3 policy (i): A3 is included when target ≥ 6.5", () => {
    const codes = generateRoadmap(req({ currentBand: "5.5", targetBand: "6.5" })).courses.map((c) => c.code);
    expect(codes).toContain("A3");
  });
});
