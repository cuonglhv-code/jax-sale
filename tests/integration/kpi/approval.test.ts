import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore, approveActualCore, rejectActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T021 (US7): approve/reject are atomic transitions with a status-log (§V, D-APPROVAL). Approve only
 * from pending; reject only from pending; editing an approved actual reverts it to pending (AC-7.1/
 * 7.2/7.5, SC-007).
 */
describe("kpi: approval transitions (approve_personal_kpi / reject_personal_kpi)", () => {
  const period = "2026-10";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("approves a pending actual and writes a pending->approved status log", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    const entry = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "revenue",
      actual: 100,
    });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    const approved = await approveActualCore(managerClient, managerClaims, entry.id);

    expect(approved.approvalStatus).toBe("approved");

    const { data: logs } = await managerClient
      .from("personal_kpi_status_logs")
      .select("from_status, to_status")
      .eq("entry_id", entry.id)
      .eq("to_status", "approved");
    expect(logs?.some((l) => l.from_status === "pending")).toBe(true);
  });

  it("rejects a pending actual and keeps it excluded (still rejected, not approved)", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    const entry = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "enrolments_closed",
      actual: 2,
    });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    const rejected = await rejectActualCore(managerClient, managerClaims, entry.id, "Sai số liệu");

    expect(rejected.approvalStatus).toBe("rejected");

    const { data: logs } = await managerClient
      .from("personal_kpi_status_logs")
      .select("from_status, to_status, note")
      .eq("entry_id", entry.id)
      .eq("to_status", "rejected");
    expect(logs?.[0]?.note).toBe("Sai số liệu");
  });

  it("rejects an approve/reject attempt on an already-approved row (not pending)", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    const entry = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "revenue",
      actual: 50,
    });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await approveActualCore(managerClient, managerClaims, entry.id);

    await expect(approveActualCore(managerClient, managerClaims, entry.id)).rejects.toThrow();
  });

  it("editing an approved actual reverts it to pending (AC-1.4/7.5)", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    const entry = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "revenue",
      actual: 30,
    });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await approveActualCore(managerClient, managerClaims, entry.id);

    const edited = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "revenue",
      actual: 45,
    });
    expect(edited.approvalStatus).toBe("pending");
  });
});
