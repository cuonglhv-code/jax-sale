import { describe, it, expect } from "vitest";
import { listEmployeesCore } from "@/services/task.service";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { signInAs, SEEDED_USERS, SEED_CENTRE_Q1, SEED_CENTRE_Q3 } from "../helpers/auth";

describe("tasks: listEmployeesCore", () => {
  it("scopes to the caller's own centre for a non-network-wide role", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertAuthenticated(client);

    const rows = await listEmployeesCore(client, claims, {});

    expect(rows.length).toBeGreaterThan(0);
    // every returned row must resolve (via RLS) to Q1 — proven indirectly: the same query run as
    // a Q3 user must NOT return the same ids as this one.
    const q1Ids = new Set(rows.map((r) => r.id));

    const q3Client = await signInAs(SEEDED_USERS.managerQ3);
    const q3Claims = await assertAuthenticated(q3Client);
    const q3Rows = await listEmployeesCore(q3Client, q3Claims, {});

    for (const r of q3Rows) {
      expect(q1Ids.has(r.id)).toBe(false);
    }
  });

  it("returns fullName, departmentId, departmentName, avatarColor for each row", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertAuthenticated(client);

    const rows = await listEmployeesCore(client, claims, {});

    expect(rows[0]).toMatchObject({
      id: expect.any(String),
      fullName: expect.any(String),
      departmentId: expect.any(String),
      departmentName: expect.any(String),
      avatarColor: expect.any(String),
    });
  });

  it("super_admin sees network-wide employees when centreId is omitted", async () => {
    const client = await signInAs(SEEDED_USERS.superAdmin);
    const claims = await assertAuthenticated(client);

    const all = await listEmployeesCore(client, claims, {});
    const q1Only = await listEmployeesCore(client, claims, { centreId: SEED_CENTRE_Q1 });
    const q3Only = await listEmployeesCore(client, claims, { centreId: SEED_CENTRE_Q3 });

    expect(all.length).toBeGreaterThanOrEqual(q1Only.length + q3Only.length);
  });
});
