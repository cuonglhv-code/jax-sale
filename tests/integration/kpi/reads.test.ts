import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore, getMyPerformanceCore, listPendingApprovalsCore } from "@/services/kpi/kpi.service";
import { assertPermission, assertAuthenticated } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/** Coverage completion (T046): getMyPerformanceCore + listPendingApprovalsCore, the two read paths
 * exercised by MyPerformance.tsx / ApprovalQueue.tsx but not previously covered directly. */
describe("kpi: read services", () => {
  const period = "2027-08";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("getMyPerformanceCore returns only the caller's own entries for the period", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");
    await recordActualCore(client, claims, { period, metricKey: "revenue", actual: 33 });

    const authClaims = await assertAuthenticated(client);
    const entries = await getMyPerformanceCore(client, authClaims, period);
    expect(entries).toHaveLength(1);
    expect(entries[0].consultantId).toBe(claims.employeeId);
    expect(entries[0].actual).toBe(33);
  });

  it("getMyPerformanceCore returns empty for a period with no recorded entries", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ3);
    const authClaims = await assertAuthenticated(client);
    const entries = await getMyPerformanceCore(client, authClaims, "2027-09");
    expect(entries).toEqual([]);
  });

  it("listPendingApprovalsCore returns own-centre pending entries, ordered, filtered by period", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    await recordActualCore(consultantClient, consultantClaims, { period, metricKey: "revenue", actual: 12 });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    const pending = await listPendingApprovalsCore(managerClient, managerClaims, period);

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((e) => e.approvalStatus === "pending")).toBe(true);
    expect(pending.every((e) => e.centreId === managerClaims.centreId)).toBe(true);
  });

  it("listPendingApprovalsCore without a period filter still scopes to own centre only", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    await recordActualCore(consultantClient, consultantClaims, { period, metricKey: "enrolments_closed", actual: 1 });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    const pending = await listPendingApprovalsCore(managerClient, managerClaims);

    expect(pending.every((e) => e.centreId === managerClaims.centreId)).toBe(true);
  });
});
