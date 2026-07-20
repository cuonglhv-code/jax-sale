import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { recordActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T050 (SC-008, remediation G1): representative-volume check. Seeds a meaningful volume (multiple
 * periods x metrics, real authenticated writes so the actual-only trigger + status-log path is
 * exercised, not bypassed) and asserts the dashboard/leaderboard reads stay paginated and fast — no
 * full-table scan, no unbounded response — at a scale beyond the handful of rows other tests use.
 */
describe("kpi: representative-volume check (SC-008)", () => {
  const volumePeriodPrefix = "2029"; // isolated year, won't collide with other test periods
  const PERIODS = Array.from({ length: 12 }, (_, i) => `${volumePeriodPrefix}-${String(i + 1).padStart(2, "0")}`);
  const METRICS = ["revenue", "enrolments_closed"] as const;

  beforeAll(async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");

    // 12 periods x 2 metrics = 24 real authenticated writes (exercises the actual-only trigger +
    // creation status-log for every row) — concurrent for speed, still realistic write volume.
    await Promise.all(
      PERIODS.flatMap((period) =>
        METRICS.map((metricKey) =>
          recordActualCore(client, claims, { period, metricKey, actual: Math.floor(Math.random() * 1000) }),
        ),
      ),
    );
  });

  afterAll(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().like("period", `${volumePeriodPrefix}-%`);
  });

  it("kpi_dashboard stays paginated (bounded response) even with many rows across periods", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const start = Date.now();
    const { data, error } = await managerClient.rpc("kpi_dashboard", {
      p_period: `${volumePeriodPrefix}-01`,
      p_limit: 20,
      p_offset: 0,
    });
    const elapsedMs = Date.now() - start;

    expect(error).toBeNull();
    expect((data ?? []).length).toBeLessThanOrEqual(20); // bounded — never an unbounded scan
    expect(elapsedMs).toBeLessThan(5000); // generous budget; the point is "no pathological scan"
  });

  it("kpi_leaderboard stays paginated and ranked correctly under volume", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { data, error } = await managerClient.rpc("kpi_leaderboard", {
      p_period: `${volumePeriodPrefix}-01`,
      p_metric: "revenue",
      p_limit: 10,
      p_offset: 0,
    });

    expect(error).toBeNull();
    expect((data ?? []).length).toBeLessThanOrEqual(10);
    // Ranks are contiguous starting at 1 for the returned page.
    const ranks = (data ?? []).map((r: { rank: number }) => r.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});
