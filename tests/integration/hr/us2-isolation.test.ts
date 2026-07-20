import { describe, it, expect } from "vitest";
import { decideRequestCore } from "@/services/hr-request.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { DomainError } from "@/lib/server-action";
import { HR_SEED, hrClientFor } from "./_setup";

/**
 * US2 (T031): manager.q3 (centre_manager of centre Q3) must not be able to READ or DECIDE the
 * seeded annual-leave request that belongs to teacher.q1 / centre Q1. Two layers are proven:
 *  1. RLS (`hr_request_select_scoped`) — the row is invisible to a centre-B manager's own SELECT.
 *  2. `decideRequestCore`'s own service-layer check — even if a row *were* visible, deciding a
 *     request outside the actor's centre must be refused (defense in depth, not solely RLS).
 */
describe("hr US2: centre isolation on decide", () => {
  it("a centre-B manager cannot SELECT a centre-A request", async () => {
    const q3Client = await hrClientFor("managerQ3");
    const { data, error } = await q3Client
      .from("hr_request")
      .select("id")
      .eq("id", HR_SEED.requestAnnualLeave)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull(); // RLS hides the row entirely — not an empty-but-visible row
  });

  it("a centre-B manager cannot decide a centre-A request", async () => {
    const q3Client = await hrClientFor("managerQ3");
    const claims = await assertPermission(q3Client, "hrRequest.decide");

    await expect(
      decideRequestCore(q3Client, claims, {
        requestId: HR_SEED.requestAnnualLeave,
        decision: "approve",
      }),
    ).rejects.toThrow(DomainError);
  });
});
