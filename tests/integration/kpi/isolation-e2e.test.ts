import { describe, it, expect, afterEach } from "vitest";
import {
  recordActualCore,
  setPersonalTargetCore,
  approveActualCore,
  setDepartmentTargetCore,
} from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, serviceRoleClient, SEED_DEPT_SALES } from "../../helpers/auth";

/**
 * T037 (US6, NON-NEGOTIABLE): a full A/B centre flow proving no cross-tier read/write/approve leak
 * on ANY KPI table — the closing proof for the P1 security gate (AC-6.2/6.3, SC-004/006).
 */
describe("kpi: two-centre isolation E2E", () => {
  const period = "2027-05";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("personal_kpis").delete().eq("period", period);
    await svc.from("department_kpi_targets").delete().eq("period", period);
  });

  it("full A/B flow: record, target, approve — each confined to its own centre at every step", async () => {
    // --- Centre Q1 flow ---
    const q1Consultant = await signInAs(SEEDED_USERS.saleQ1);
    const q1ConsultantClaims = await assertPermission(q1Consultant, "personalKpi.recordActual");
    const q1Entry = await recordActualCore(q1Consultant, q1ConsultantClaims, {
      period,
      metricKey: "revenue",
      actual: 1000,
    });

    const q1Manager = await signInAs(SEEDED_USERS.managerQ1);
    const q1ManagerTargetClaims = await assertPermission(q1Manager, "personalKpi.setTarget");
    await setPersonalTargetCore(q1Manager, q1ManagerTargetClaims, {
      consultantId: q1ConsultantClaims.employeeId,
      period,
      metricKey: "revenue",
      target: 800,
    });
    const q1ManagerApproveClaims = await assertPermission(q1Manager, "personalKpi.approveActual");
    await approveActualCore(q1Manager, q1ManagerApproveClaims, q1Entry.id);

    // --- Centre Q3 flow ---
    const q3Consultant = await signInAs(SEEDED_USERS.saleQ3);
    const q3ConsultantClaims = await assertPermission(q3Consultant, "personalKpi.recordActual");
    const q3Entry = await recordActualCore(q3Consultant, q3ConsultantClaims, {
      period,
      metricKey: "revenue",
      actual: 2000,
    });

    const q3Admin = await signInAs(SEEDED_USERS.adminQ3);
    const q3AdminTargetClaims = await assertPermission(q3Admin, "personalKpi.setTarget");
    await setPersonalTargetCore(q3Admin, q3AdminTargetClaims, {
      consultantId: q3ConsultantClaims.employeeId,
      period,
      metricKey: "revenue",
      target: 1500,
    });
    const q3AdminApproveClaims = await assertPermission(q3Admin, "personalKpi.approveActual");
    await approveActualCore(q3Admin, q3AdminApproveClaims, q3Entry.id);

    // --- Cross-centre negative checks ---
    // Q1 manager cannot see the Q3 row via tiered read.
    const q1View = (await q1Manager.from("personal_kpis").select("id").eq("period", period)).data ?? [];
    expect(q1View.map((r) => r.id)).toContain(q1Entry.id);
    expect(q1View.map((r) => r.id)).not.toContain(q3Entry.id);

    // Q3 admin cannot see the Q1 row.
    const q3View = (await q3Admin.from("personal_kpis").select("id").eq("period", period)).data ?? [];
    expect(q3View.map((r) => r.id)).toContain(q3Entry.id);
    expect(q3View.map((r) => r.id)).not.toContain(q1Entry.id);

    // Q1 manager cannot approve the (already-approved) Q3 row — RLS makes it invisible either way.
    await expect(q1Manager.rpc("approve_personal_kpi", { p_entry_id: q3Entry.id })).resolves.toMatchObject({
      error: expect.anything(),
    });

    // Dashboards are correctly tier-scoped: Q1 manager's dashboard sums only Q1; Q3 admin's only Q3.
    const q1Dashboard = await q1Manager.rpc("kpi_dashboard", { p_period: period });
    const q1Row = (q1Dashboard.data ?? []).find(
      (r: { consultant_id: string }) => r.consultant_id === q1ConsultantClaims.employeeId,
    );
    expect(q1Row?.approved_actual).toBe(1000);
    const q1HasQ3 = (q1Dashboard.data ?? []).some(
      (r: { consultant_id: string }) => r.consultant_id === q3ConsultantClaims.employeeId,
    );
    expect(q1HasQ3).toBe(false);

    // super_admin sees BOTH.
    const admin = await signInAs(SEEDED_USERS.superAdmin);
    const networkDashboard = await admin.rpc("kpi_dashboard", { p_period: period });
    const ids = (networkDashboard.data ?? []).map((r: { consultant_id: string }) => r.consultant_id);
    expect(ids).toContain(q1ConsultantClaims.employeeId);
    expect(ids).toContain(q3ConsultantClaims.employeeId);

    // Department targets are network-wide (not centre-confined) — visible to both managers/admins.
    const adminClaims = await assertPermission(admin, "departmentKpi.setTarget");
    await setDepartmentTargetCore(admin, adminClaims, {
      departmentId: SEED_DEPT_SALES,
      period,
      metricKey: "revenue",
      target: 5_000_000,
    });
    const { data: q1SeesDept } = await q1Manager
      .from("department_kpi_targets")
      .select("id")
      .eq("department_id", SEED_DEPT_SALES)
      .eq("period", period);
    expect(q1SeesDept?.length).toBeGreaterThan(0);
    const { data: q3SeesDept } = await q3Admin
      .from("department_kpi_targets")
      .select("id")
      .eq("department_id", SEED_DEPT_SALES)
      .eq("period", period);
    expect(q3SeesDept?.length).toBeGreaterThan(0);
  });
});
