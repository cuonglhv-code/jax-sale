import { describe, it, expect } from "vitest";
import { deactivateEmployeeCore } from "@/services/personnel.service";
import { assertAuthenticated, assertPermission } from "@/lib/auth/assert-permission";
import {
  signInAs,
  serviceRoleClient,
  SEEDED_USERS,
  SEED_CENTRE_Q1,
  SEED_DEPT_SALES,
} from "../helpers/auth";

/**
 * Phase 7 (T050): deactivateEmployee writes an `employee.deactivate` audit entry (+ a distinct
 * `employee.forceSignout` entry per the C1 disambiguation); the deactivated user's PRE-EXISTING
 * session cannot act on its very next request (FR-005/007a, SC-003a) — enforced by
 * assertAuthenticated's fresh is_active re-check, independent of JWT/session staleness.
 *
 * Uses a throwaway employee (created via the service-role client) rather than a shared seed
 * fixture, so this test cannot corrupt state that other test files depend on.
 */
describe("personnel: deactivate + immediate revocation", () => {
  it("blocks the deactivated user's next request and writes both audit entries", async () => {
    const admin = serviceRoleClient();
    const email = `throwaway-deactivate-${Date.now()}@jaxtina.test`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: "Password123!",
      email_confirm: true,
    });
    if (createError || !created.user) throw new Error(`setup failed: ${createError?.message}`);

    const { error: empError } = await admin.from("employees").insert({
      auth_user_id: created.user.id,
      full_name: "Throwaway Test Employee",
      email,
      app_role: "sale_consultant",
      centre_id: SEED_CENTRE_Q1,
      department_id: SEED_DEPT_SALES,
      is_active: true,
    });
    if (empError) throw new Error(`setup failed: ${empError.message}`);

    // Hold a session established BEFORE deactivation.
    const targetClient = await signInAs(email);
    await expect(assertAuthenticated(targetClient)).resolves.toBeDefined();

    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "employee.deactivate");

    const { data: targetRow } = await managerClient
      .from("employees")
      .select("id")
      .eq("email", email)
      .single();
    const employeeId = targetRow?.id as string;

    await deactivateEmployeeCore(managerClient, admin, managerClaims, employeeId);

    // The pre-existing session must be rejected on its very next request.
    await expect(assertAuthenticated(targetClient)).rejects.toThrow();

    const deactivateAudit = await managerClient
      .from("audit_log")
      .select("id")
      .eq("entity_id", employeeId)
      .eq("action", "employee.deactivate");
    expect(deactivateAudit.data?.length).toBe(1);

    const forceSignoutAudit = await managerClient
      .from("audit_log")
      .select("id")
      .eq("entity_id", employeeId)
      .eq("action", "employee.forceSignout");
    expect(forceSignoutAudit.data?.length).toBe(1);
  });
});
