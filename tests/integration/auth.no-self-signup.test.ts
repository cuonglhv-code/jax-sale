import { describe, it, expect } from "vitest";
import { anonClient } from "../helpers/auth";

/**
 * Polish (T057): assert no public self-registration exists (FR-006). Platform-level backstop —
 * `enable_signup = false` in supabase/config.toml — not just the absence of a signup page/action
 * in the app. Accounts originate only from seed/admin provisioning.
 */
describe("auth: no public self-signup", () => {
  it("refuses a public signUp attempt", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signUp({
      email: `unauthorized-signup-${Date.now()}@jaxtina.test`,
      password: "Password123!",
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });
});
