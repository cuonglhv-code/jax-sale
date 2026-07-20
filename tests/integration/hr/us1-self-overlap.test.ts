import { describe, it, expect } from "vitest";
import { submitRequestCore } from "@/services/hr-request.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError } from "@/lib/server-action";
import { serviceRoleClient } from "../../helpers/auth";
import { hrClientFor } from "./_setup";

/**
 * US1 (T016a): a second annual-leave request whose date range overlaps the submitter's own
 * pending request is rejected with a friendly Vietnamese DomainError, and no new request row is
 * written for the rejected attempt (edge case: shared submit path, leave-family types).
 */
describe("hr US1: self-overlap guard", () => {
  it("rejects an overlapping annual-leave submission for the same submitter", async () => {
    const client = await hrClientFor("teacherQ1");
    const claims = await assertPermission(client, "hrRequest.submit");

    const first = await submitRequestCore(client, claims, {
      requestType: "annual_leave",
      startDate: "2026-10-05",
      endDate: "2026-10-06",
      dayPart: "full",
    });

    try {
      await expect(
        submitRequestCore(client, claims, {
          requestType: "annual_leave",
          startDate: "2026-10-06",
          endDate: "2026-10-07",
          dayPart: "full",
        }),
      ).rejects.toThrow(DomainError);

      const rejectedProbe = await client
        .from("hr_request")
        .select("id", { count: "exact", head: true })
        .eq("submitter_id", claims.employeeId)
        .eq("start_date", "2026-10-06");
      expect(rejectedProbe.count ?? 0).toBe(0);
    } finally {
      await serviceRoleClient().from("hr_request").update({ status: "cancelled" }).eq("id", first.id);
    }
  });
});
