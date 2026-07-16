/**
 * T008 — Summit pricing (FR-015/016): total is the arithmetic sum of the illuminated stages'
 * prices from the centre's list — nothing more (clarified 2026-07-17).
 */

import { describe, it, expect } from "vitest";
import { generateSummitRoadmap } from "@/services/ielts/summit-engine";
import type { SummitRequest } from "@/services/ielts/summit-types";
import { PRICES } from "@/lib/domain/ielts/pricing";
import type { Band } from "@/lib/domain/ielts/bands";

function req(currentBand: Band, targetBand: Band): SummitRequest {
  return {
    studentName: "Minh Anh",
    currentBand,
    targetBand,
    placement: { kind: "measured", testDate: null },
  };
}

describe("summit pricing (FR-016: arithmetic sum only)", () => {
  it("4.5→7.0 total equals the hand-computed sum of B2+A1+A2+A3+INT", () => {
    const p = PRICES.default;
    const expected = p.B2! + p.A1! + p.A2! + p.A3! + p.INT!;
    const roadmap = generateSummitRoadmap(req("4.5", "7.0"), "default");
    expect(roadmap.totalPrice.amount).toBe(expected);
    expect(roadmap.totalPrice.excludesUnpriced).toBe(false);
  });

  it("every climb stage carries its centre-list price; non-climb stages are still priced data", () => {
    const roadmap = generateSummitRoadmap(req("4.5", "7.0"), "default");
    for (const stage of roadmap.stages) {
      const listed = PRICES.default[stage.code];
      expect(stage.price).toBe(listed ?? null);
    }
  });

  it("an unpriced climb stage (PRE_S) is excluded from the total and sets the flag", () => {
    const roadmap = generateSummitRoadmap(req("below A1", "2.5"), "default");
    const p = PRICES.default;
    expect(roadmap.totalPrice.amount).toBe(p.IF1!); // PRE_S has no price; IF1 completes the climb
    expect(roadmap.totalPrice.excludesUnpriced).toBe(true);
  });

  it("total recomputes when the target changes (pure function of the climb)", () => {
    const p = PRICES.default;
    const to60 = generateSummitRoadmap(req("4.5", "6.0"), "default");
    expect(to60.totalPrice.amount).toBe(p.B2! + p.A1! + p.INT!);
    const to55 = generateSummitRoadmap(req("4.5", "5.5"), "default");
    expect(to55.totalPrice.amount).toBe(p.B2! + p.INT!);
  });
});
