import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * Regression test (code review finding, CRITICAL): super_admin is seeded with a concrete home
 * centre_id (Q1, same as every role — the access-token hook does not special-case network-wide
 * roles). `pkpi_select_tiered` correctly bypasses the centre check for super_admin, but
 * `pkpi_update_scoped` and `pkpi_logs_insert_own_centre` originally did not, so `approve_personal_kpi`
 * /`reject_personal_kpi` silently failed ("not found") for any row outside super_admin's own home
 * centre — contradicting the documented network-wide tier. Fixed by adding the same super_admin
 * bypass already present on the SELECT policies to both UPDATE/INSERT policies.
 */
describe("kpi: super_admin cross-centre approve/reject (network-wide write)", () => {
  const period = "2027-11";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  it("super_admin (home centre Q1) approves a Q3 consultant's pending row", async () => {
    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    const entry = await recordActualCore(q3Client, q3Claims, { period, metricKey: "revenue", actual: 42 });

    const admin = await signInAs(SEEDED_USERS.superAdmin);
    const { data, error } = await admin.rpc("approve_personal_kpi", { p_entry_id: entry.id });

    expect(error).toBeNull();
    expect(data?.approval_status).toBe("approved");
  });

  it("super_admin (home centre Q1) rejects a Q3 consultant's pending row", async () => {
    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    const entry = await recordActualCore(q3Client, q3Claims, {
      period,
      metricKey: "enrolments_closed",
      actual: 3,
    });

    const admin = await signInAs(SEEDED_USERS.superAdmin);
    const { data, error } = await admin.rpc("reject_personal_kpi", { p_entry_id: entry.id, p_note: null });

    expect(error).toBeNull();
    expect(data?.approval_status).toBe("rejected");
  });

  it("the approve transition writes a status-log row even for a cross-centre super_admin action", async () => {
    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    const entry = await recordActualCore(q3Client, q3Claims, { period, metricKey: "revenue", actual: 15 });

    const admin = await signInAs(SEEDED_USERS.superAdmin);
    await admin.rpc("approve_personal_kpi", { p_entry_id: entry.id });

    const { data: logs } = await admin
      .from("personal_kpi_status_logs")
      .select("from_status, to_status")
      .eq("entry_id", entry.id)
      .eq("to_status", "approved");
    expect(logs?.length).toBeGreaterThan(0);
  });
});
