import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore, approveActualCore, rejectActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { classifyAttainment } from "@/services/kpi/attainment";
import { rollupPeriods } from "@/services/kpi/rollup";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T032 (US3): pending/rejected actuals are excluded from every aggregate; quarter/year rollups sum
 * approved-only monthly figures correctly (AC-3.7, SC-009).
 */
describe("kpi: approved-only aggregation", () => {
  const period = "2027-03";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("kpi_dashboard excludes rejected actuals from approved_actual", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");
    const entry = await recordActualCore(client, claims, { period, metricKey: "enrolments_closed", actual: 9 });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await rejectActualCore(managerClient, managerClaims, entry.id);

    const { data } = await managerClient.rpc("kpi_dashboard", { p_period: period });
    const row = (data ?? []).find(
      (r: { consultant_id: string; metric_key: string }) =>
        r.consultant_id === entry.consultantId && r.metric_key === "enrolments_closed",
    );
    expect(row?.approved_actual ?? 0).toBe(0);
  });

  it("quarter rollup sums approved-only monthly attainments correctly (D-PERIOD)", () => {
    // Pure logic check — feeds classified monthly attainments (already approved-only) into rollupPeriods.
    const jan = classifyAttainment("revenue", 100, 300);
    const feb = classifyAttainment("revenue", 150, 300);
    const mar = classifyAttainment("revenue", 200, 300);
    const quarter = rollupPeriods([jan, feb, mar]);
    expect(quarter.approvedActual).toBe(450);
    expect(quarter.target).toBe(900);
    expect(quarter.state).toBe("behind");
  });
});
