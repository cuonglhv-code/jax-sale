import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T016 (US1): a role lacking `personalKpi.recordActual` is denied; recording seeds `pending` + a
 * `null->pending` status-log; re-recording (edit) reverts to `pending` (AC-1.1).
 */
describe("kpi: record actual (service + permission gate)", () => {
  const period = "2026-09";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("denies a role without personalKpi.recordActual (e.g. teacher)", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    await expect(assertPermission(client, "personalKpi.recordActual")).rejects.toThrow(ForbiddenError);
  });

  it("a sale_consultant recording an actual seeds pending + a null->pending log", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");

    const entry = await recordActualCore(client, claims, {
      period,
      metricKey: "revenue",
      actual: 250,
    });

    expect(entry.approvalStatus).toBe("pending");
    expect(entry.actual).toBe(250);
    expect(entry.consultantId).toBe(claims.employeeId);
    expect(entry.centreId).toBe(claims.centreId);

    const { data: logs } = await client
      .from("personal_kpi_status_logs")
      .select("from_status, to_status")
      .eq("entry_id", entry.id);
    expect(logs?.some((l) => l.from_status === null && l.to_status === "pending")).toBe(true);
  });

  it("re-recording the same period/metric upserts and stays scoped to the caller's own row", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");

    const first = await recordActualCore(client, claims, { period, metricKey: "enrolments_closed", actual: 2 });
    const second = await recordActualCore(client, claims, { period, metricKey: "enrolments_closed", actual: 5 });

    expect(second.id).toBe(first.id); // same (consultant, period, metric) row — unique constraint upsert
    expect(second.actual).toBe(5);
  });
});
