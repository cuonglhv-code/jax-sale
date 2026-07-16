import { describe, it, expect } from "vitest";
import { signInCore } from "@/services/auth.service";
import { anonClient, SEEDED_USERS } from "../helpers/auth";

/**
 * US1 (T024): a deactivated account cannot obtain a usable session (FR-005). Supabase's own
 * signInWithPassword has no concept of `employees.is_active`, so this is enforced by OUR
 * `signInCore` service, which must check is_active post-auth and refuse to establish a usable
 * session (signing the client back out if it was inactive).
 */
describe("auth: deactivated account", () => {
  it("cannot obtain a usable session even with the correct password", async () => {
    const client = anonClient();
    await expect(
      signInCore(client, { email: SEEDED_USERS.deactivatedQ1, password: "Password123!" }),
    ).rejects.toThrow();

    // The client must not be left holding a usable session for a deactivated account.
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
  });
});
