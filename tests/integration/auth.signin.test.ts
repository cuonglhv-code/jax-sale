import { describe, it, expect } from "vitest";
import { signInCore } from "@/services/auth.service";
import { anonClient, SEEDED_USERS } from "../helpers/auth";

/**
 * US1 (T023): sign-in success sets role/centre/employee claims; wrong password returns a generic
 * Vietnamese error with no email-existence leak. Real Supabase auth — no mocking (Principle IV).
 * FR-001/002.
 */
describe("auth: sign-in", () => {
  it("establishes a session with role/centre/employee claims on correct credentials", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: SEEDED_USERS.superAdmin,
      password: "Password123!",
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();

    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    expect(claimsError).toBeNull();
    expect(claimsData?.claims.app_role).toBe("super_admin");
    expect(claimsData?.claims.centre_id).toBeTruthy();
    expect(claimsData?.claims.employee_id).toBeTruthy();
  });

  it("rejects an incorrect password without revealing whether the email exists", async () => {
    const clientKnownEmail = anonClient();
    const { error: err1 } = await clientKnownEmail.auth.signInWithPassword({
      email: SEEDED_USERS.superAdmin,
      password: "wrong-password",
    });

    const clientUnknownEmail = anonClient();
    const { error: err2 } = await clientUnknownEmail.auth.signInWithPassword({
      email: "does-not-exist@jaxtina.test",
      password: "wrong-password",
    });

    expect(err1).not.toBeNull();
    expect(err2).not.toBeNull();
    // Same generic failure for both a known and an unknown email — no account-existence leak.
    expect(err1?.status).toBe(err2?.status);
  });

  it("signInCore itself throws the same generic message for wrong password and unknown email", async () => {
    const client1 = anonClient();
    await expect(
      signInCore(client1, { email: SEEDED_USERS.superAdmin, password: "wrong-password" }),
    ).rejects.toThrow("Email hoặc mật khẩu không đúng.");

    const client2 = anonClient();
    await expect(
      signInCore(client2, { email: "does-not-exist@jaxtina.test", password: "wrong-password" }),
    ).rejects.toThrow("Email hoặc mật khẩu không đúng.");
  });

  it("signInCore resolves role/centre/employee via getClaims on success", async () => {
    const client = anonClient();
    const result = await signInCore(client, {
      email: SEEDED_USERS.managerQ1,
      password: "Password123!",
    });
    expect(result.role).toBe("centre_manager");
    expect(result.centreId).toBeTruthy();
    expect(result.employeeId).toBeTruthy();
  });
});
