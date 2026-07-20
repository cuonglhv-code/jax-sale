import { describe, it, expect } from "vitest";
import { assertPermission } from "@/lib/auth/assert-permission";
import { UnauthenticatedError } from "@/lib/server-action";
import { anonClient, SEEDED_USERS, signInAs } from "../../helpers/auth";

/**
 * US1 (T017): an INACTIVE employee (deactivated.q1, seeded), and an unauthenticated caller, are
 * both refused at the auth gate before any write. Every ACTIVE role holds `hrRequest.submit`
 * (data-model §13) — this proves the auth gate, not role-gating.
 */
describe("hr US1: submit auth gate", () => {
  it("rejects an inactive employee even with a valid password session", async () => {
    // Raw signInWithPassword succeeds (Supabase Auth has no concept of employees.is_active); the
    // app-level gate (assertAuthenticated re-checking is_active fresh) is what must refuse it.
    const client = await signInAs(SEEDED_USERS.deactivatedQ1);
    await expect(assertPermission(client, "hrRequest.submit")).rejects.toThrow(UnauthenticatedError);
  });

  it("rejects an unauthenticated caller", async () => {
    const client = anonClient();
    await expect(assertPermission(client, "hrRequest.submit")).rejects.toThrow(UnauthenticatedError);
  });
});
