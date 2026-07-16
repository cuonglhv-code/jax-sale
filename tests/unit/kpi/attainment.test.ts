import { describe, it, expect } from "vitest";
import { classifyAttainment } from "@/services/kpi/attainment";
import { ATTAINMENT_STATES } from "@/lib/data/types";

describe("classifyAttainment", () => {
  it("returns not_set with null ratio when target is null — NEVER 0% (SC-002)", () => {
    const a = classifyAttainment("revenue", 0, null);
    expect(a.state).toBe("not_set");
    expect(a.ratio).toBeNull();
  });

  it("returns on_track when approved actual >= target", () => {
    const a = classifyAttainment("enrolments_closed", 10, 10);
    expect(a.state).toBe("on_track");
    expect(a.ratio).toBe(1);
  });

  it("returns behind when 0 < approved actual < target", () => {
    const a = classifyAttainment("revenue", 6, 10);
    expect(a.state).toBe("behind");
    expect(a.ratio).toBeCloseTo(0.6);
  });

  it("returns no_result (meaningful 0) when target is set and approved actual is 0", () => {
    const a = classifyAttainment("revenue", 0, 10);
    expect(a.state).toBe("no_result");
    expect(a.ratio).toBe(0);
  });

  it("invariant: state is not_set IFF target is null; ratio is null IFF target is null", () => {
    for (const target of [null, 1, 5, 100]) {
      for (const actual of [0, 3, 5, 200]) {
        const a = classifyAttainment("revenue", actual, target as number | null);
        expect(a.state === "not_set").toBe(target === null);
        expect(a.ratio === null).toBe(target === null);
        expect(ATTAINMENT_STATES).toContain(a.state);
      }
    }
  });
});
