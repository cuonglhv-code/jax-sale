/**
 * T009 — Summit timeline (FR-004): weeks = sessions ÷ pace; the DISPLAYED duration is always a
 * min–max range over the provisional 2.4–3.0/wk pace band (clarified 2026-07-17) — never a
 * single point.
 */

import { describe, it, expect } from "vitest";
import { generateSummitRoadmap } from "@/services/ielts/summit-engine";
import type { SummitRequest } from "@/services/ielts/summit-types";
import { SUMMIT_PACE, WEEKS_PER_MONTH, type Band } from "@/lib/domain/ielts/bands";

function req(currentBand: Band, targetBand: Band): SummitRequest {
  return {
    studentName: "Minh Anh",
    currentBand,
    targetBand,
    placement: { kind: "measured", testDate: null },
  };
}

describe("summit timeline (FR-004)", () => {
  it("4.5→7.0 (128 buổi): week range = sessions ÷ [maxRate, minRate]", () => {
    const roadmap = generateSummitRoadmap(req("4.5", "7.0"), "default");
    expect(roadmap.totalSessions).toBe(128);
    expect(roadmap.durationWeeks.min).toBeCloseTo(128 / SUMMIT_PACE.maxRate, 5);
    expect(roadmap.durationWeeks.max).toBeCloseTo(128 / SUMMIT_PACE.minRate, 5);
    expect(roadmap.durationMonths.min).toBeCloseTo(roadmap.durationWeeks.min / WEEKS_PER_MONTH, 5);
    expect(roadmap.durationMonths.max).toBeCloseTo(roadmap.durationWeeks.max / WEEKS_PER_MONTH, 5);
  });

  it("is always a genuine range — min strictly below max for every climb", () => {
    const pairs: Array<[Band, Band]> = [["~A1", "3.5"], ["4.5", "5.5"], ["7.0", "7.5"]];
    for (const [c, t] of pairs) {
      const roadmap = generateSummitRoadmap(req(c, t), "default");
      expect(roadmap.durationWeeks.min).toBeLessThan(roadmap.durationWeeks.max);
      expect(roadmap.durationMonths.min).toBeLessThan(roadmap.durationMonths.max);
    }
  });

  it("projected finish is a window (earliest < latest) anchored to the given day", () => {
    const roadmap = generateSummitRoadmap(req("4.5", "6.0"), "default", "2026-07-17");
    expect(roadmap.projectedFinish).not.toBeNull();
    expect(roadmap.projectedFinish!.earliest < roadmap.projectedFinish!.latest).toBe(true);
    expect(roadmap.projectedFinish!.earliest > "2026-07-17").toBe(true);
  });

  it("PRE_S contributes no sessions and flags the flexible base (D-PRES)", () => {
    const withBase = generateSummitRoadmap(req("below A1", "2.5"), "default");
    const without = generateSummitRoadmap(req("~A1", "2.5"), "default");
    expect(withBase.totalSessions).toBe(without.totalSessions); // PRE_S adds zero
    expect(withBase.hasFlexibleBase).toBe(true);
    expect(without.hasFlexibleBase).toBe(false);
  });
});
