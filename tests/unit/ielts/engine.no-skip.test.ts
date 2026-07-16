import { describe, it, expect } from "vitest";
import { generateRoadmap } from "@/services/ielts/roadmap-engine";
import { RUNGS } from "@/lib/domain/ielts/courses";
import { CURRENT_BAND_OPTIONS, TARGET_BAND_OPTIONS, bandValue } from "@/lib/domain/ielts/bands";
import type { RoadmapRequest } from "@/services/ielts/types";
import type { Band } from "@/lib/domain/ielts/bands";

/**
 * US2 (T015) — NON-NEGOTIABLE: the roadmap never skips a level. For EVERY entry/target pair, the
 * rung sequence must be a CONTIGUOUS sub-array of the ladder rungs (no gap). SC-002 / AC-2.4.
 * Uses a non-overriding audience (SINH_VIEN) to isolate pure slicing.
 */

function req(current: Band, target: Band): RoadmapRequest {
  return {
    studentName: "Test",
    audience: "SINH_VIEN", // no start override, no GP insert
    studentEmail: "t@example.com",
    studentPhone: null,
    currentBand: current,
    targetBand: target,
    examPurpose: "KHAC",
    targetExamDate: null,
    intensity: "TIEU_CHUAN",
    consultantName: "C",
    consultantPhone: null,
    consultantEmail: null,
    centreId: "x",
    startDate: "2026-01-01",
  };
}

const rungIndex = new Map(RUNGS.map((c, i) => [c.code, i]));

describe("engine: no level skipping (exhaustive)", () => {
  const pairs: [Band, Band][] = [];
  for (const c of CURRENT_BAND_OPTIONS) {
    for (const t of TARGET_BAND_OPTIONS) {
      if (bandValue(t) > bandValue(c)) pairs.push([c, t]);
    }
  }

  it.each(pairs)("current %s → target %s yields a contiguous rung slice", (current, target) => {
    const roadmap = generateRoadmap(req(current, target));
    const rungCodes = roadmap.courses
      .filter((rc) => rungIndex.has(rc.code))
      .map((rc) => rungIndex.get(rc.code)!);

    // Contiguous: every rung index is exactly one more than the previous (no gap = no skip).
    for (let i = 1; i < rungCodes.length; i++) {
      expect(rungCodes[i]).toBe(rungCodes[i - 1] + 1);
    }
  });

  it("starts at the rung matching the current band (e.g. 2.5 → IF2, 3.5 → B1)", () => {
    expect(generateRoadmap(req("2.5", "5.5")).courses[0].code).toBe("IF2");
    expect(generateRoadmap(req("3.5", "5.5")).courses[0].code).toBe("B1");
  });

  it("ends the RUNG slice at the first rung whose output meets the target (2.5 → 5.5 = IF2,B1,B2)", () => {
    // Filter to rungs — INT (an append) may follow per AC-3.1; the rung slice itself is the no-skip unit.
    const rungCodes = generateRoadmap(req("2.5", "5.5")).courses
      .filter((c) => rungIndex.has(c.code))
      .map((c) => c.code);
    expect(rungCodes).toEqual(["IF2", "B1", "B2"]);
  });
});
