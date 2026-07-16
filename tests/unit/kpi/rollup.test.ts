import { describe, it, expect } from "vitest";
import { rollupAttainment, rollupPeriods, rankLeaderboard } from "@/services/kpi/rollup";
import { classifyAttainment } from "@/services/kpi/attainment";
import type { PersonalKpiEntry } from "@/lib/data/types";

const row = (over: Partial<PersonalKpiEntry>): PersonalKpiEntry => ({
  id: "id",
  consultantId: "c",
  centreId: "ce",
  period: "2026-07",
  metricKey: "revenue",
  target: null,
  actual: 0,
  approvalStatus: "approved",
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("rollupAttainment", () => {
  it("sums only APPROVED actuals; sums targets across all in-scope rows (SC-009)", () => {
    const a = rollupAttainment(
      [
        row({ actual: 100, approvalStatus: "approved", target: 500 }),
        row({ actual: 50, approvalStatus: "pending", target: 300 }),
        row({ actual: 999, approvalStatus: "rejected", target: null }),
      ],
      "revenue",
    );
    expect(a.approvedActual).toBe(100); // pending + rejected excluded
    expect(a.target).toBe(800); // 500 + 300 (targets not gated by approval)
    expect(a.state).toBe("behind");
  });

  it("is not_set when no in-scope row has a target", () => {
    const a = rollupAttainment([row({ actual: 10, target: null, approvalStatus: "approved" })], "revenue");
    expect(a.state).toBe("not_set");
    expect(a.ratio).toBeNull();
  });

  it("ignores rows of other metrics", () => {
    const a = rollupAttainment(
      [row({ metricKey: "enrolments_closed", actual: 5, target: 3 }), row({ metricKey: "revenue", actual: 7, target: 10 })],
      "revenue",
    );
    expect(a.approvedActual).toBe(7);
  });
});

describe("rollupPeriods", () => {
  it("sums approved actuals and present targets across member months", () => {
    const a = rollupPeriods([
      classifyAttainment("revenue", 100, 200),
      classifyAttainment("revenue", 300, 200),
    ]);
    expect(a.approvedActual).toBe(400);
    expect(a.target).toBe(400);
    expect(a.state).toBe("on_track");
  });
});

describe("rankLeaderboard", () => {
  it("ranks by approvedActual desc, ties broken by name asc (deterministic, AC-4.4)", () => {
    const ranked = rankLeaderboard([
      { consultantId: "1", name: "Bình", approvedActual: 10 },
      { consultantId: "2", name: "An", approvedActual: 10 },
      { consultantId: "3", name: "Cường", approvedActual: 20 },
    ]);
    expect(ranked.map((e) => e.name)).toEqual(["Cường", "An", "Bình"]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3]);
  });
});
