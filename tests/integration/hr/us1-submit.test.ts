import { describe, it, expect } from "vitest";
import { submitRequestCore, listMyRequestsCore } from "@/services/hr-request.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { serviceRoleClient } from "../../helpers/auth";
import { hrClientFor } from "./_setup";

/**
 * US1 (T016): submitting annual leave creates a `pending` hr_request scoped to the submitter's own
 * centre (from claims, never from input), one `from_status=null` history row, and one
 * `hrRequest.submit` audit row. Also proves the request appears in "my requests" (US1 acceptance).
 */
describe("hr US1: submit annual leave", () => {
  it("creates a pending request, centre from claims, initial history row, and audit entry", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const request = await submitRequestCore(client, claims, {
      requestType: "annual_leave",
      startDate: "2026-09-14",
      endDate: "2026-09-15",
      dayPart: "full",
    });

    try {
      expect(request.status).toBe("pending");
      expect(request.centreId).toBe(claims.centreId);
      expect(request.submitterId).toBe(claims.employeeId);
      expect(request.workingDays).toBe(2);

      const history = await client.from("hr_request_status_history").select("*").eq("request_id", request.id);
      expect(history.data?.length).toBe(1);
      expect(history.data?.[0].from_status).toBeNull();
      expect(history.data?.[0].to_status).toBe("pending");

      // audit_log read RLS restricts SELECT to super_admin/centre_manager/centre_admin (the
      // teacher submitter cannot read their own audit rows) — use the service-role client to
      // verify the write itself, independent of that read-scoping.
      const audits = await serviceRoleClient()
        .from("audit_log")
        .select("*")
        .eq("entity_id", request.id)
        .eq("action", "hrRequest.submit");
      expect(audits.data?.length).toBe(1);

      const mine = await listMyRequestsCore(client, claims);
      expect(mine.some((r) => r.id === request.id)).toBe(true);
    } finally {
      // Cleanup: move the probe request out of `pending` so re-runs never trip the self-overlap
      // guard (T020a) against a leftover row from a previous run.
      await serviceRoleClient().from("hr_request").update({ status: "cancelled" }).eq("id", request.id);
    }
  });
});
