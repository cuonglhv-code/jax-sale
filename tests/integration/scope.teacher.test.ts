import { describe, it, expect } from "vitest";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { listTasksCore } from "@/services/task.service";
import { signInAs, SEEDED_USERS, SEED_EMPLOYEE_TEACHER_Q1 } from "../helpers/auth";

/** US2 (T031): a teacher's listTasks returns only tasks assigned to them (FR-017). */
describe("scope: teacher own-assigned only", () => {
  it("returns only tasks assigned to the signed-in teacher, even if mine=false is requested", async () => {
    const client = await signInAs(SEEDED_USERS.teacherQ1);
    const claims = await assertAuthenticated(client);

    const result = await listTasksCore(client, claims, { mine: false });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((t) => t.assigneeId === SEED_EMPLOYEE_TEACHER_Q1)).toBe(true);
  });
});
