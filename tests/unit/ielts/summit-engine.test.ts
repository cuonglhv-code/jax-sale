/**
 * T007 — Summit engine (contracts/summit-engine.md). The no-skip invariant is exhaustive over
 * every valid band pair (Constitution II / SC-004); INT-only and out-of-reach behaviour per
 * clarification 2026-07-17.
 */

import { describe, it, expect } from "vitest";
import { generateSummitRoadmap } from "@/services/ielts/summit-engine";
import { SummitInputError, type SummitRequest } from "@/services/ielts/summit-types";
import { RUNGS } from "@/lib/domain/ielts/courses";
import {
  BANDS,
  bandValue,
  CURRENT_BAND_OPTIONS,
  TARGET_BAND_OPTIONS,
  type Band,
} from "@/lib/domain/ielts/bands";

const RUNG_CODES = RUNGS.map((c) => c.code);
const CURRENTS: Band[] = ["below A1", ...CURRENT_BAND_OPTIONS];

function req(currentBand: Band, targetBand: Band): SummitRequest {
  return {
    studentName: "Minh Anh",
    currentBand,
    targetBand,
    placement: { kind: "measured", testDate: null },
  };
}

function climbCodes(roadmap: ReturnType<typeof generateSummitRoadmap>) {
  return roadmap.stages.filter((s) => s.state === "climb").map((s) => s.code);
}

describe("summit engine: contiguity — exhaustive over all valid band pairs (SC-004)", () => {
  it("every climb is a contiguous RUNGS subarray plus an optional trailing INT; never empty", () => {
    for (const current of CURRENTS) {
      for (const target of TARGET_BAND_OPTIONS) {
        if (bandValue(target) <= bandValue(current)) continue;
        const roadmap = generateSummitRoadmap(req(current, target), "default");
        const codes = climbCodes(roadmap);
        expect(codes.length, `${current}→${target}`).toBeGreaterThan(0);

        const rungPart = codes.filter((c) => c !== "INT");
        if (rungPart.length > 0) {
          const start = RUNG_CODES.indexOf(rungPart[0]);
          expect(start, `${current}→${target} start`).toBeGreaterThanOrEqual(0);
          expect(
            rungPart.join(","),
            `${current}→${target} contiguous`,
          ).toBe(RUNG_CODES.slice(start, start + rungPart.length).join(","));
        }
        // INT, when present, is exactly one trailing summit stage.
        expect(codes.filter((c) => c === "INT").length).toBeLessThanOrEqual(1);
        if (codes.includes("INT")) expect(codes[codes.length - 1]).toBe("INT");
        // GP never appears on the summit path.
        expect(codes).not.toContain("GP");
      }
    }
  });

  it("stages render the full ladder bottom-to-top with a below/climb/above partition", () => {
    const roadmap = generateSummitRoadmap(req("4.5", "7.0"), "default");
    expect(roadmap.stages.map((s) => s.code)).toEqual([...RUNG_CODES, "INT"]);
    const states = roadmap.stages.map((s) => s.state);
    // below* climb* above* — no interleaving other than the INT summit row.
    const collapsed = states.join(",");
    // PRE_S, IF1, IF2, B1 sit below a 4.5 entry; B2→A3+INT are the climb.
    expect(collapsed).toBe("below,below,below,below,climb,climb,climb,climb,climb");
  });
});

describe("summit engine: INT append rule (FR-003)", () => {
  it("4.5→7.0 climbs B2→A1→A2→A3 plus INT", () => {
    const roadmap = generateSummitRoadmap(req("4.5", "7.0"), "default");
    expect(climbCodes(roadmap)).toEqual(["B2", "A1", "A2", "A3", "INT"]);
    expect(roadmap.consultantAdvisory).toBeNull();
  });

  it("targets below 5.5 never get INT", () => {
    const roadmap = generateSummitRoadmap(req("~A1", "3.5"), "default");
    expect(climbCodes(roadmap)).toEqual(["IF1", "IF2"]);
  });

  it("INT-only climb: 7.0→7.5 is [INT], valid, no advisory (clarified 2026-07-17)", () => {
    const roadmap = generateSummitRoadmap(req("7.0", "7.5"), "default");
    expect(climbCodes(roadmap)).toEqual(["INT"]);
    expect(roadmap.consultantAdvisory).toBeNull();
    expect(roadmap.totalSessions).toBe(16);
  });

  it("6.5→7.0: A3 meets the target exactly; INT still appends (gap 0 ≤ 0.5)", () => {
    const roadmap = generateSummitRoadmap(req("6.5", "7.0"), "default");
    expect(climbCodes(roadmap)).toEqual(["A3", "INT"]);
  });
});

describe("summit engine: out-of-reach targets (clarified 2026-07-17)", () => {
  it("6.5→8.0+: highest honest climb (A3+INT) with consultant advisory, never empty", () => {
    const roadmap = generateSummitRoadmap(req("6.5", "8.0+"), "default");
    expect(climbCodes(roadmap)).toEqual(["A3", "INT"]);
    expect(roadmap.consultantAdvisory).not.toBeNull();
  });

  it("7.0→8.0+: INT-only highest honest climb with advisory", () => {
    const roadmap = generateSummitRoadmap(req("7.0", "8.0+"), "default");
    expect(climbCodes(roadmap)).toEqual(["INT"]);
    expect(roadmap.consultantAdvisory).not.toBeNull();
  });
});

describe("summit engine: degenerate inputs", () => {
  it("target ≤ current throws SummitInputError (Vietnamese message)", () => {
    expect(() => generateSummitRoadmap(req("5.5", "5.5"), "default")).toThrow(SummitInputError);
    expect(() => generateSummitRoadmap(req("6.0", "5.5"), "default")).toThrow(SummitInputError);
  });

  it("band inputs outside the known scale are rejected", () => {
    const bad = { ...req("4.5", "7.0"), currentBand: "9.9" as (typeof BANDS)[number] };
    expect(() => generateSummitRoadmap(bad, "default")).toThrow();
  });
});

describe("summit engine: Pre-S base (D-PRES)", () => {
  it("below A1 starts at PRE_S with null sessions and the flexible-base flag", () => {
    const roadmap = generateSummitRoadmap(req("below A1", "3.5"), "default");
    const codes = climbCodes(roadmap);
    expect(codes[0]).toBe("PRE_S");
    const preS = roadmap.stages.find((s) => s.code === "PRE_S");
    expect(preS?.sessions).toBeNull();
    expect(roadmap.hasFlexibleBase).toBe(true);
  });
});

describe("summit engine: mode carriage (Constitution III)", () => {
  it("placement passes through untouched on every output", () => {
    const measured = generateSummitRoadmap(req("4.5", "6.0"), "default");
    expect(measured.request.placement).toEqual({ kind: "measured", testDate: null });
    const estimated = generateSummitRoadmap(
      { ...req("4.5", "6.0"), placement: { kind: "estimated" } },
      "default",
    );
    expect(estimated.request.placement).toEqual({ kind: "estimated" });
  });
});
