import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";
import { submitRequestCore } from "@/services/hr-request.service";
import { deactivateEmployeeCore } from "@/services/personnel.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { serviceRoleClient } from "../../helpers/auth";
import { hrClientFor } from "./_setup";

/**
 * US2 (T032a): deactivating an employee who has a pending annual-leave request auto-closes it —
 * the request moves to `cancelled` (edge case: submitter leaves while pending), any consumed
 * balance is restored (none here — the request never reached `approved`), a history row is
 * written, and it is audited. Uses a fresh probe employee (not any of the shared seeded logins)
 * so this test never leaves the shared teacher.q1 account deactivated for other suites.
 */
describe("hr US2: deactivation auto-closes pending requests", () => {
  it("cancels a pending request and audits it when the submitter is deactivated", async () => {
    const svc = serviceRoleClient();

    // A disposable probe employee in centre Q1, teacher role, active — created via service-role
    // (bypasses RLS, mirroring how seed.sql itself inserts employees) so this test owns its own
    // lifecycle independent of the shared seeded logins.
    const probeAuthId = crypto.randomUUID();
    const probeEmployeeId = crypto.randomUUID();
    const probeEmail = `probe.us2a.${probeAuthId}@jaxtina.test`;

    const { error: authError } = await svc.auth.admin.createUser({
      id: probeAuthId,
      email: probeEmail,
      password: "Password123!",
      email_confirm: true,
    });
    if (authError) throw new Error(`probe auth user creation failed: ${authError.message}`);

    const { error: empError } = await svc.from("employees").insert({
      id: probeEmployeeId,
      auth_user_id: probeAuthId,
      full_name: "Probe US2a",
      email: probeEmail,
      app_role: "teacher",
      centre_id: "00000000-0000-4000-8000-000000000001",
      department_id: "00000000-0000-4000-8000-0000000000d4",
      is_active: true,
      avatar_color: "#5B8DEF",
    });
    if (empError) throw new Error(`probe employee creation failed: ${empError.message}`);

    try {
      // Sign in as the PROBE specifically (hrClientFor only knows the fixed seeded roster).
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error: signInError } = await anon.auth.signInWithPassword({
        email: probeEmail,
        password: "Password123!",
      });
      if (signInError) throw new Error(`probe sign-in failed: ${signInError.message}`);

      const claims = await assertPermission(anon, "hrRequest.submit");
      const request = await submitRequestCore(anon, claims, {
        requestType: "annual_leave",
        startDate: "2026-12-01",
        endDate: "2026-12-01",
        dayPart: "full",
      });
      expect(request.status).toBe("pending");

      const managerClient = await hrClientFor("managerQ1");
      const managerClaims = await assertPermission(managerClient, "employee.deactivate");
      await deactivateEmployeeCore(managerClient, svc, managerClaims, probeEmployeeId);

      const { data: closedRequest } = await svc
        .from("hr_request")
        .select("status")
        .eq("id", request.id)
        .single();
      expect(closedRequest?.status).toBe("cancelled");

      const history = await svc
        .from("hr_request_status_history")
        .select("*")
        .eq("request_id", request.id)
        .order("created_at", { ascending: true });
      expect(history.data?.length).toBe(2);
      expect(history.data?.[1].to_status).toBe("cancelled");

      const audits = await svc
        .from("audit_log")
        .select("*")
        .eq("entity_id", request.id)
        .eq("action", "hrRequest.cancel");
      expect(audits.data?.length).toBe(1);
    } finally {
      await svc.from("employees").delete().eq("id", probeEmployeeId);
      await svc.auth.admin.deleteUser(probeAuthId);
    }
  });
});
