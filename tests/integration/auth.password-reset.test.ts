import { describe, it, expect } from "vitest";
import { requestPasswordResetCore, resetPasswordCore } from "@/services/auth.service";
import { anonClient, SEEDED_USERS } from "../helpers/auth";

/** Polish (coverage gap close): FR-004 password-reset flow — request + set new password. */
describe("auth: password reset", () => {
  it("requestPasswordResetCore does not throw for a known email", async () => {
    const client = anonClient();
    await expect(
      requestPasswordResetCore(client, { email: SEEDED_USERS.superAdmin }, "http://localhost:3000/reset-password"),
    ).resolves.toBeUndefined();
  });

  it("requestPasswordResetCore does not throw for an unknown email either (no enumeration leak)", async () => {
    const client = anonClient();
    await expect(
      requestPasswordResetCore(
        client,
        { email: "does-not-exist@jaxtina.test" },
        "http://localhost:3000/reset-password",
      ),
    ).resolves.toBeUndefined();
  });

  it("resetPasswordCore rejects when the caller has no recovery session", async () => {
    // Without a genuine recovery session (normally established by following the emailed link),
    // updateUser must fail — proving resetPasswordCore does not silently succeed unauthenticated.
    const client = anonClient();
    await expect(resetPasswordCore(client, { newPassword: "NewPassword123!" })).rejects.toThrow();
  });
});
