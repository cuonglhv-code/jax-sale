import { describe, it, expect, afterEach } from "vitest";
import { setDepartmentTargetCore } from "@/services/kpi/kpi.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { signInAs, SEEDED_USERS, serviceRoleClient, SEED_DEPT_SALES } from "../../helpers/auth";

/**
 * T027 (US2): only super_admin manages department targets (§13 two-table/two-key invariant); every
 * other role is denied; department targets are NOT centre-confined (AC-2.3/2.4, SC-005).
 */
describe("kpi: department target (setDepartmentTargetCore)", () => {
  const period = "2027-01";

  afterEach(async () => {
    const svc = serviceRoleClient();
    await svc.from("department_kpi_targets").delete().eq("period", period);
  });

  it("super_admin can set a network-wide department target", async () => {
    const adminClient = await signInAs(SEEDED_USERS.superAdmin);
    const adminClaims = await assertPermission(adminClient, "departmentKpi.setTarget");

    const target = await setDepartmentTargetCore(adminClient, adminClaims, {
      departmentId: SEED_DEPT_SALES,
      period,
      metricKey: "revenue",
      target: 50_000_000,
    });

    expect(target.target).toBe(50_000_000);
    expect(target.departmentId).toBe(SEED_DEPT_SALES);
  });

  it("denies every non-super_admin role (centre_manager, centre_admin, sale_consultant)", async () => {
    for (const email of [SEEDED_USERS.managerQ1, SEEDED_USERS.adminQ3, SEEDED_USERS.saleQ1]) {
      const client = await signInAs(email);
      await expect(assertPermission(client, "departmentKpi.setTarget")).rejects.toThrow(ForbiddenError);
    }
  });

  it("denies a raw INSERT into department_kpi_targets by a non-admin (RLS Pattern B write-admin)", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const { error } = await managerClient.from("department_kpi_targets").insert({
      department_id: SEED_DEPT_SALES,
      period,
      metric_key: "revenue",
      target: 999,
    });
    expect(error).not.toBeNull();
  });
});
