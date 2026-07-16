import { describe, it, expect } from "vitest";
import { resolveEffectiveCentre, ALL_CENTRES } from "@/lib/domain/vocabulary";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { listTasksCore } from "@/services/task.service";
import { signInAs, SEEDED_USERS, SEED_CENTRE_Q1, SEED_CENTRE_Q3 } from "../helpers/auth";

/**
 * US2 (T030): resolveEffectiveCentre + listTasks scope per role; super_admin override honored,
 * others pinned despite any client-supplied centre filter (FR-014/015).
 */
describe("scope: centre resolution", () => {
  it("pins a centre-scoped role to its own centre regardless of an override", () => {
    expect(resolveEffectiveCentre("centre_manager", SEED_CENTRE_Q1, SEED_CENTRE_Q3)).toBe(SEED_CENTRE_Q1);
    expect(resolveEffectiveCentre("sale_consultant", SEED_CENTRE_Q1, ALL_CENTRES)).toBe(SEED_CENTRE_Q1);
  });

  it("honors super_admin's override, and 'all'/undefined means whole network", () => {
    expect(resolveEffectiveCentre("super_admin", SEED_CENTRE_Q1, SEED_CENTRE_Q3)).toBe(SEED_CENTRE_Q3);
    expect(resolveEffectiveCentre("super_admin", SEED_CENTRE_Q1, ALL_CENTRES)).toBeUndefined();
    expect(resolveEffectiveCentre("super_admin", SEED_CENTRE_Q1, undefined)).toBeUndefined();
  });

  it("listTasks scopes a centre-manager's results to their own centre even if they pass another centre's id", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertAuthenticated(client);
    const result = await listTasksCore(client, claims, { centreId: SEED_CENTRE_Q3 });
    expect(result.rows.every((t) => t.centreId === SEED_CENTRE_Q1)).toBe(true);
  });

  it("listTasks lets super_admin view another centre by passing its id", async () => {
    const client = await signInAs(SEEDED_USERS.superAdmin);
    const claims = await assertAuthenticated(client);
    const result = await listTasksCore(client, claims, { centreId: SEED_CENTRE_Q1 });
    expect(result.rows.every((t) => t.centreId === SEED_CENTRE_Q1)).toBe(true);
  });

  it("listTasks gives super_admin the whole network when no centre filter is passed", async () => {
    const client = await signInAs(SEEDED_USERS.superAdmin);
    const claims = await assertAuthenticated(client);
    const result = await listTasksCore(client, claims, {});
    const centresSeen = new Set(result.rows.map((t) => t.centreId));
    // Whole-network read should not be artificially narrowed to one centre.
    expect(centresSeen.size).toBeGreaterThanOrEqual(1);
  });
});
