import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { anonClient, SEEDED_USERS } from "../helpers/auth";

/**
 * US1 (T025): the Layer-1 route guard redirects unauthenticated navigation to a protected route
 * to /login; sign-out ends the session. FR-003, spec US1 acceptance scenarios 2/3.
 */
describe("auth: route guard & sign-out", () => {
  it("redirects an unauthenticated request for a protected route to /login", async () => {
    const request = new NextRequest("http://localhost:3000/tasks");
    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("does not redirect requests to /login itself", async () => {
    const request = new NextRequest("http://localhost:3000/login");
    const response = await proxy(request);
    expect(response.status).not.toBe(307);
  });

  it("ends the session on sign-out", async () => {
    const client = anonClient();
    await client.auth.signInWithPassword({
      email: SEEDED_USERS.superAdmin,
      password: "Password123!",
    });
    const before = await client.auth.getSession();
    expect(before.data.session).not.toBeNull();

    await client.auth.signOut();
    const after = await client.auth.getSession();
    expect(after.data.session).toBeNull();
  });
});
