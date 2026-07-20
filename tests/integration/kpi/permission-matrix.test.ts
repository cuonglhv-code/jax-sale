import { describe, it, expect } from "vitest";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import type { AppRole } from "@/lib/data/types";
import type { PermissionKey } from "@/lib/auth/permissions";
import { signInAs, SEEDED_USERS } from "../../helpers/auth";

/**
 * T035 (US6, NON-NEGOTIABLE): each of the four KPI permission keys grants exactly its intended roles;
 * every other role is rejected. Proven against the real permission gate (AC-6.1, SC-003/005).
 */
describe("kpi: permission matrix (all 4 keys)", () => {
  const emailByRole: Record<AppRole, string> = {
    super_admin: SEEDED_USERS.superAdmin,
    centre_manager: SEEDED_USERS.managerQ1,
    centre_admin: SEEDED_USERS.adminQ3,
    sale_consultant: SEEDED_USERS.saleQ1,
    teacher: SEEDED_USERS.teacherQ1,
  };

  // super_admin holds the `system.admin` catch-all (permissions.ts), which satisfies EVERY key by
  // design (existing slice-#001 pattern) — so super_admin is always additionally granted.
  const matrix: { key: PermissionKey; grantedTo: AppRole[] }[] = [
    { key: "personalKpi.recordActual", grantedTo: ["sale_consultant", "super_admin"] },
    { key: "personalKpi.approveActual", grantedTo: ["centre_manager", "centre_admin", "super_admin"] },
    { key: "personalKpi.setTarget", grantedTo: ["centre_manager", "centre_admin", "super_admin"] },
    { key: "departmentKpi.setTarget", grantedTo: ["super_admin"] },
  ];

  const allRoles: AppRole[] = ["super_admin", "centre_manager", "centre_admin", "sale_consultant", "teacher"];

  for (const { key, grantedTo } of matrix) {
    for (const role of allRoles) {
      const shouldGrant = grantedTo.includes(role);
      it(`${key}: ${role} is ${shouldGrant ? "GRANTED" : "DENIED"}`, async () => {
        const client = await signInAs(emailByRole[role]);
        if (shouldGrant) {
          await expect(assertPermission(client, key)).resolves.toBeDefined();
        } else {
          await expect(assertPermission(client, key)).rejects.toThrow(ForbiddenError);
        }
      });
    }
  }
});
