import { describe, it, expect, afterEach } from "vitest";
import { recordActualCore, setPersonalTargetCore, approveActualCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient } from "../../helpers/auth";

/**
 * T031 (US3): the tiered SELECT RLS on personal_kpis (D-TIER) — the §13-sanctioned own-row exception,
 * stricter than the foundation's broad read. consultant=own only; centre mgr/admin=own centre; super_
 * admin=all; teacher=none (AC-3.1/3.2/3.3/3.4, SC-006).
 */
describe("kpi: tiered read (personal_kpis SELECT)", () => {
  const period = "2027-02";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
  });

  async function seedTwoCentreRows() {
    const q1Client = await signInAs(SEEDED_USERS.saleQ1);
    const q1Claims = await assertPermission(q1Client, "personalKpi.recordActual");
    const q1Entry = await recordActualCore(q1Client, q1Claims, { period, metricKey: "revenue", actual: 10 });

    const q3Client = await signInAs(SEEDED_USERS.saleQ3);
    const q3Claims = await assertPermission(q3Client, "personalKpi.recordActual");
    const q3Entry = await recordActualCore(q3Client, q3Claims, { period, metricKey: "revenue", actual: 20 });

    return { q1Entry, q3Entry };
  }

  it("a sale_consultant sees only their OWN row", async () => {
    const { q1Entry, q3Entry } = await seedTwoCentreRows();
    const client = await signInAs(SEEDED_USERS.saleQ1);
    const { data } = await client.from("personal_kpis").select("id").eq("period", period);
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(q1Entry.id);
    expect(ids).not.toContain(q3Entry.id);
  });

  it("a centre_manager/centre_admin sees only their OWN centre's rows", async () => {
    const { q1Entry, q3Entry } = await seedTwoCentreRows();

    const q1Manager = await signInAs(SEEDED_USERS.managerQ1);
    const q1Data = (await q1Manager.from("personal_kpis").select("id").eq("period", period)).data ?? [];
    expect(q1Data.map((r) => r.id)).toContain(q1Entry.id);
    expect(q1Data.map((r) => r.id)).not.toContain(q3Entry.id);

    const q3Admin = await signInAs(SEEDED_USERS.adminQ3);
    const q3Data = (await q3Admin.from("personal_kpis").select("id").eq("period", period)).data ?? [];
    expect(q3Data.map((r) => r.id)).toContain(q3Entry.id);
    expect(q3Data.map((r) => r.id)).not.toContain(q1Entry.id);
  });

  it("super_admin sees ALL centres' rows", async () => {
    const { q1Entry, q3Entry } = await seedTwoCentreRows();
    const admin = await signInAs(SEEDED_USERS.superAdmin);
    const data = (await admin.from("personal_kpis").select("id").eq("period", period)).data ?? [];
    const ids = data.map((r) => r.id);
    expect(ids).toContain(q1Entry.id);
    expect(ids).toContain(q3Entry.id);
  });

  it("a teacher sees NO rows (no branch in the tiered policy)", async () => {
    await seedTwoCentreRows();
    const teacher = await signInAs(SEEDED_USERS.teacherQ1);
    const { data } = await teacher.from("personal_kpis").select("id").eq("period", period);
    expect(data ?? []).toHaveLength(0);
  });

  it("only approved actuals appear via the kpi_dashboard aggregation function (AC-3.7, SC-009)", async () => {
    const q1Client = await signInAs(SEEDED_USERS.saleQ1);
    const q1Claims = await assertPermission(q1Client, "personalKpi.recordActual");
    const entry = await recordActualCore(q1Client, q1Claims, { period, metricKey: "revenue", actual: 77 });

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "personalKpi.approveActual");

    const beforeApprove = await managerClient.rpc("kpi_dashboard", { p_period: period });
    const rowBefore = (beforeApprove.data ?? []).find(
      (r: { consultant_id: string; metric_key: string }) => r.consultant_id === entry.consultantId && r.metric_key === "revenue",
    );
    expect(rowBefore?.approved_actual ?? 0).toBe(0); // pending excluded

    await approveActualCore(managerClient, managerClaims, entry.id);

    const afterApprove = await managerClient.rpc("kpi_dashboard", { p_period: period });
    const rowAfter = (afterApprove.data ?? []).find(
      (r: { consultant_id: string; metric_key: string }) => r.consultant_id === entry.consultantId && r.metric_key === "revenue",
    );
    expect(rowAfter?.approved_actual).toBe(77);
  });
});
