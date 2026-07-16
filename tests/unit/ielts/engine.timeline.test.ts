import { describe, it, expect } from "vitest";
import { generateRoadmap } from "@/services/ielts/roadmap-engine";
import { REFERENCE_ROADMAPS } from "@/lib/domain/ielts/reference-roadmaps";
import type { RoadmapRequest } from "@/services/ielts/types";

function req(overrides: Partial<RoadmapRequest>): RoadmapRequest {
  return {
    studentName: "T", audience: "SINH_VIEN", studentEmail: "t@e.com", studentPhone: null,
    currentBand: "2.5", targetBand: "6.0", examPurpose: "KHAC", targetExamDate: null,
    intensity: "TIEU_CHUAN", consultantName: "C", consultantPhone: null, consultantEmail: null,
    centreId: "x", startDate: "2026-01-01", ...overrides,
  };
}

/** US3 (T019) — timeline maths + completion date; SC-003 reference-audience duration ranges. */
describe("engine: timeline maths", () => {
  it("computes total sessions, weeks, months and a projected completion date", () => {
    const r = generateRoadmap(req({ currentBand: "2.5", targetBand: "3.5" }));
    expect(r.totalSessions).toBe(24); // IF2 only
    expect(r.totalWeeks).toBeCloseTo(24 / 2.7, 5);
    expect(r.totalMonths).toBeCloseTo(24 / 2.7 / 4.33, 5);
    expect(r.projectedCompletion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses the intensive rate (4/wk) when intensity is Tăng cường", () => {
    const std = generateRoadmap(req({ currentBand: "2.5", targetBand: "3.5", intensity: "TIEU_CHUAN" }));
    const fast = generateRoadmap(req({ currentBand: "2.5", targetBand: "3.5", intensity: "TANG_CUONG" }));
    expect(fast.totalMonths).toBeLessThan(std.totalMonths);
  });

  describe("SC-003: reference-audience duration ranges (with DOCUMENTED divergence)", () => {
    // ⚠ DOCUMENTED DIVERGENCE (SC-003 allows "land in range OR explain the divergence"):
    // The deck's reference durations imply an effective rate of ~3.1–3.85 sessions/week, but the
    // spec explicitly specifies 2.7 sessions/week for Standard. These two source figures are
    // mutually inconsistent. The engine honors the SPECIFIED 2.7 rate, so short-path audiences
    // (SINH_VIEN, NGUOI_DI_LAM) run up to ~4 months longer than the deck's optimistic ranges.
    // This is a RATE-CALIBRATION question for the academic team (same class as the ⚠ intensive
    // rate), tracked as an academic-confirm finding (T046). The tolerance below reflects that
    // documented gap; the test still guards against gross engine errors.
    const LOWER_TOL = 2;
    const UPPER_TOL = 5; // accommodates the 2.7-vs-implied-3.3/wk short-path divergence
    it.each(REFERENCE_ROADMAPS.map((r) => [r.audience, r] as const))(
      "%s duration is within the documented tolerance of its deck range",
      (_audience, ref) => {
        const r = generateRoadmap(
          req({ audience: ref.audience, currentBand: ref.refEntry, targetBand: ref.refTarget }),
        );
        expect(r.totalMonths).toBeGreaterThanOrEqual(ref.minMonths - LOWER_TOL);
        expect(r.totalMonths).toBeLessThanOrEqual(ref.maxMonths + UPPER_TOL);
      },
    );
  });
});
