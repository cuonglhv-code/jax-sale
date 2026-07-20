import { describe, it, expect } from "vitest";
import { navItemsForRole, NAV_ITEMS } from "@/lib/domain/vocabulary";
import { roleHasPermission } from "@/lib/auth/permissions";

/**
 * US1 (T022): the employee submit + "my requests" surface must be reachable by every role,
 * including `teacher` — proven two ways:
 *  1. the `hrRequests` NAV_ITEM (a NEW top-level route, deliberately NOT under the existing
 *     `personnel` `/nhan-su` entry, whose roles are restricted to super_admin/centre_manager) is
 *     granted to every role, so it appears in the sidebar for all of them (`navItemsForRole`) and
 *     satisfies the Layer-1 proxy's protected-route membership check.
 *  2. `hrRequest.submit` — the actual Layer-2 gate the submit action enforces — is held by every
 *     role (data-model §13), so a teacher reaching the page can actually submit.
 */
describe("hr US1: /yeu-cau route access", () => {
  const ALL_ROLES = ["super_admin", "centre_manager", "centre_admin", "sale_consultant", "teacher"] as const;

  it("includes hrRequests in the sidebar for every role, including teacher", () => {
    for (const role of ALL_ROLES) {
      const keys = navItemsForRole(role).map((i) => i.key);
      expect(keys).toContain("hrRequests");
    }
  });

  it("does not reuse the restricted personnel route (/nhan-su)", () => {
    const hrRequestsItem = NAV_ITEMS.find((i) => i.key === "hrRequests");
    expect(hrRequestsItem).toBeDefined();
    expect(hrRequestsItem?.route).not.toBe("/nhan-su");
    expect(hrRequestsItem?.route.startsWith("/nhan-su")).toBe(false);
  });

  it("grants hrRequest.submit (the real page/action gate) to every role, including teacher", () => {
    for (const role of ALL_ROLES) {
      expect(roleHasPermission(role, "hrRequest.submit")).toBe(true);
    }
  });
});
