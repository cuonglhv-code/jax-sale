import { describe, it, expect } from "vitest";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { hrClientFor } from "./_setup";

/**
 * US2 (T030): a non-manager caller (teacher, sale_consultant — neither holds `hrRequest.decide` per
 * data-model §13) is refused at the permission gate before `decideRequestCore` ever runs an RPC or
 * touches the DB. Mirrors us1-submit-auth.test.ts's style of proving the gate directly via
 * `assertPermission`, since `decideRequestCore`'s own action (`decide-request.ts`) always calls
 * `assertPermission(supabase, "hrRequest.decide")` first in the canonical pipeline (contracts
 * hr-requests.actions.md).
 */
describe("hr US2: decideRequest permission gate", () => {
  it("rejects a teacher (no hrRequest.decide grant)", async () => {
    const client = await hrClientFor("teacherQ1");
    await expect(assertPermission(client, "hrRequest.decide")).rejects.toThrow(ForbiddenError);
  });

  it("rejects a sale_consultant (no hrRequest.decide grant)", async () => {
    const client = await hrClientFor("saleQ1");
    await expect(assertPermission(client, "hrRequest.decide")).rejects.toThrow(ForbiddenError);
  });
});
