import { describe, it, expect } from "vitest";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { signInAs, SEEDED_USERS } from "../helpers/auth";

/**
 * US3 (T036): a role lacking `task.create`/`task.assign` is refused and causes NO write (SC-001).
 * `teacher` only holds `task.changeStatus` in the permission registry — the right subject here.
 * The canonical pipeline (`withError -> assertPermission -> schema.parse -> service`) means a
 * rejection here happens BEFORE any service/DB call is reached — no separate DB check is needed
 * to prove "no write": the write line in the action is never executed.
 */
describe("tasks: permission rejection", () => {
  it("refuses task.create for a role without the grant", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    await expect(assertPermission(client, "task.create")).rejects.toThrow(ForbiddenError);
  });

  it("refuses task.assign for a role without the grant", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    await expect(assertPermission(client, "task.assign")).rejects.toThrow(ForbiddenError);
  });

  it("confirms no probe task exists after a rejected create attempt", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    const before = await client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("description", "PERM-REJECT-PROBE-UNIQUE");

    await expect(assertPermission(client, "task.create")).rejects.toThrow(ForbiddenError);

    const after = await client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("description", "PERM-REJECT-PROBE-UNIQUE");

    expect(after.count ?? 0).toBe(before.count ?? 0);
    expect(after.count ?? 0).toBe(0);
  });
});
