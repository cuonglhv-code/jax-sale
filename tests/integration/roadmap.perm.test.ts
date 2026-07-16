import { describe, it, expect } from "vitest";
import { assertPermission } from "@/lib/auth/assert-permission";
import { ForbiddenError } from "@/lib/server-action";
import { signInAs, SEEDED_USERS } from "../helpers/auth";

/**
 * US7 (T035) — permission-rejection: a `teacher` lacks `roadmap.generate` and is refused; the
 * canonical pipeline rejects before any DB write (SC-008). Real auth, no mocks.
 */
describe("roadmap: permission rejection", () => {
  it("refuses roadmap.generate for a teacher", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    await expect(assertPermission(client, "roadmap.generate")).rejects.toThrow(ForbiddenError);
  });

  it("grants roadmap.generate to a sale_consultant", async () => {
    const client = await signInAs(SEEDED_USERS.saleQ1);
    await expect(assertPermission(client, "roadmap.generate")).resolves.toBeDefined();
  });
});
