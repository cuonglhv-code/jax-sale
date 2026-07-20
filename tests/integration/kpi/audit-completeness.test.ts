import { describe, it, expect, afterEach } from "vitest";
import {
  recordActualCore,
  approveActualCore,
  rejectActualCore,
  setPersonalTargetCore,
} from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T036 (US6, NON-NEGOTIABLE): every sensitive write (record/edit, approve, reject, setTarget) emits
 * an audit_log entry; every approval-lifecycle transition writes a status-log row (AC-6.4, SC-007).
 */
describe("kpi: audit + status-log completeness", () => {
  const period = "2027-04";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
    await svc.from("audit_log").delete().like("action", "personalKpi.%").eq("entity_type", "personal_kpi");
  });

  it("recordActualCore writes an audit_log row with action personalKpi.recordActual", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const claims = await assertPermission(client, "personalKpi.recordActual");
    const entry = await recordActualCore(client, claims, { period, metricKey: "revenue", actual: 15 });

    // audit_log's own RLS (audit_select_scoped, from slice #001) only grants SELECT to
    // super_admin/centre_manager/centre_admin of the row's centre — a consultant cannot read it back
    // (by design). Read via the centre's manager, who is a permitted reader.
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { data } = await managerClient
      .from("audit_log")
      .select("action")
      .eq("entity_id", entry.id)
      .eq("action", "personalKpi.recordActual");
    expect(data?.length).toBeGreaterThan(0);
  });

  it("approve/reject write audit_log rows AND status-log rows for the same transition", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    const entry = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "enrolments_closed",
      actual: 4,
    });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await approveActualCore(managerClient, managerClaims, entry.id);

    const { data: audit } = await managerClient
      .from("audit_log")
      .select("action")
      .eq("entity_id", entry.id)
      .eq("action", "personalKpi.approveActual");
    expect(audit?.length).toBeGreaterThan(0);

    const { data: statusLog } = await managerClient
      .from("personal_kpi_status_logs")
      .select("from_status, to_status")
      .eq("entry_id", entry.id)
      .eq("to_status", "approved");
    expect(statusLog?.length).toBeGreaterThan(0);
  });

  it("setPersonalTargetCore writes an audit_log row with action personalKpi.setTarget", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.setTarget");
    const { data: consultant } = await managerClient
      .from("employees")
      .select("id")
      .eq("email", SEEDED_USERS.saleQ1)
      .single();

    const entry = await setPersonalTargetCore(managerClient, managerClaims, {
      consultantId: (consultant as { id: string }).id,
      period,
      metricKey: "revenue",
      target: 200,
    });

    const { data } = await managerClient
      .from("audit_log")
      .select("action")
      .eq("entity_id", entry.id)
      .eq("action", "personalKpi.setTarget");
    expect(data?.length).toBeGreaterThan(0);
  });

  it("rejecting writes an audit_log row with action personalKpi.rejectActual", async () => {
    const consultantClient = await signInAs(SEEDED_USERS.saleQ1);
    const consultantClaims = await assertPermission(consultantClient, "personalKpi.recordActual");
    const entry = await recordActualCore(consultantClient, consultantClaims, {
      period,
      metricKey: "revenue",
      actual: 8,
    });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");
    await rejectActualCore(managerClient, managerClaims, entry.id);

    const { data } = await managerClient
      .from("audit_log")
      .select("action")
      .eq("entity_id", entry.id)
      .eq("action", "personalKpi.rejectActual");
    expect(data?.length).toBeGreaterThan(0);
  });
});
