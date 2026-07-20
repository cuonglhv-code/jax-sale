import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore, approveActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { buildKpiCsv } from "@/lib/kpi/export/csv";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T041 (US5): export is tier-confined (no row beyond the caller's tier), Vietnamese-headered, and
 * reflects only approved figures (AC-5.1/5.2/5.3).
 */
describe("kpi: export tier confinement + Vietnamese headers", () => {
  const period = "2027-07";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("a centre manager's dashboard data (fed into CSV) contains ONLY their own centre's rows", async () => {
    const q1Client = await signInAs(SEEDED_USERS.saleQ1);
    const q1Claims = await assertPermission(q1Client, "personalKpi.recordActual");
    const q1Entry = await recordActualCore(q1Client, q1Claims, { period, metricKey: "revenue", actual: 100 });

    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    await recordActualCore(q3Client, q3Claims, { period, metricKey: "revenue", actual: 200 });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await approveActualCore(managerClient, managerClaims, q1Entry.id);

    const { data } = await managerClient.rpc("kpi_dashboard", { p_period: period });
    const consultantIds = (data ?? []).map((r: { consultant_id: string }) => r.consultant_id);
    expect(consultantIds).toContain(q1Claims.employeeId);
    expect(consultantIds).not.toContain(q3Claims.employeeId); // tier-confined (AC-5.2)
  });

  it("buildKpiCsv renders Vietnamese headers and correct diacritics", () => {
    const csv = buildKpiCsv(
      [
        {
          scopeId: "1",
          scopeName: "Tư vấn Q1",
          attainments: [
            { metricKey: "revenue", approvedActual: 100, target: 200, ratio: 0.5, state: "behind" },
          ],
        },
      ],
      period,
      "Trung tâm Q1",
      "2027-07-01T00:00:00Z",
    );
    expect(csv).toContain("Tư vấn viên");
    expect(csv).toContain("Kết quả (đã duyệt)");
    expect(csv).toContain("Chưa đạt"); // ATTAINMENT_STATE_LABEL.behind, correct diacritics
    expect(csv).toContain(`Kỳ: ${period}`);
  });

  it("buildKpiCsv never renders 0% for a not_set target (never-0% invariant carried into export)", () => {
    const csv = buildKpiCsv(
      [
        {
          scopeId: "1",
          scopeName: "Tư vấn Q1",
          attainments: [{ metricKey: "revenue", approvedActual: 0, target: null, ratio: null, state: "not_set" }],
        },
      ],
      period,
      "Trung tâm Q1",
      "2027-07-01T00:00:00Z",
    );
    expect(csv).toContain("Chưa đặt mục tiêu");
    expect(csv).not.toContain("0%");
  });
});
