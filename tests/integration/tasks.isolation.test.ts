import { describe, it, expect } from "vitest";
import { createTaskCore, assignTaskCore } from "@/services/task.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import {
  signInAs,
  SEEDED_USERS,
  SEED_CENTRE_Q3,
  SEED_DEPT_TEACHER,
  SEED_EMPLOYEE_TEACHER_Q1,
} from "../helpers/auth";

/**
 * US3 (T037): centre-A user cannot create/assign into centre B — including with the app gate
 * bypassed, proving RLS itself (Layer 3) is authoritative, not just the service-layer check
 * (SC-002/003). `centre_manager` (Q1) holds task.create/task.assign — the right subject.
 */
describe("tasks: centre isolation", () => {
  it("service layer refuses to assign a Q1-created task to a Q3 employee (different centre)", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertPermission(client, "task.create");

    // A Q3 employee id used as the assignee for a Q1-centre task creation.
    const q3EmployeeId = await getEmployeeId(client, SEEDED_USERS.saleQ3);

    await expect(
      createTaskCore(client, claims, {
        assigneeId: q3EmployeeId,
        departmentId: SEED_DEPT_TEACHER,
        description: "ISOLATION-PROBE-CROSS-CENTRE-ASSIGNEE",
        group: "GIANG_DAY",
        priority: "LOW",
        deadline: "2026-12-31",
        source: "SELF_CREATED",
      }),
    ).rejects.toThrow();
  });

  it("RLS itself refuses a raw cross-centre INSERT, even bypassing the guarded function (SC-003)", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1); // Q1 caller
    const teacherId = SEED_EMPLOYEE_TEACHER_Q1;

    // Direct table insert attempting to plant a task under Centre Q3 — bypasses
    // create_task_with_log entirely. RLS's own WITH CHECK on centre_id must still refuse this.
    const { error } = await client.from("tasks").insert({
      centre_id: SEED_CENTRE_Q3,
      assignee_id: teacherId,
      department_id: SEED_DEPT_TEACHER,
      description: "ISOLATION-PROBE-RAW-INSERT-BYPASS",
      group: "GIANG_DAY",
      priority: "LOW",
      deadline: "2026-12-31",
      status: "TODO",
      source: "SELF_CREATED",
      created_by: teacherId,
    });

    expect(error).not.toBeNull();

    const check = await client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("description", "ISOLATION-PROBE-RAW-INSERT-BYPASS");
    expect(check.count ?? 0).toBe(0);
  });

  it("refuses reassigning an existing task to an employee of a different centre", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertPermission(client, "task.create");

    const task = await createTaskCore(client, claims, {
      assigneeId: SEED_EMPLOYEE_TEACHER_Q1,
      departmentId: SEED_DEPT_TEACHER,
      description: "ISOLATION-PROBE-REASSIGN-BASE",
      group: "GIANG_DAY",
      priority: "LOW",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    const q3EmployeeId = await getEmployeeId(client, SEEDED_USERS.saleQ3);
    await expect(assignTaskCore(client, claims, { taskId: task.id, assigneeId: q3EmployeeId })).rejects.toThrow();
  });
});

async function getEmployeeId(client: Awaited<ReturnType<typeof signInAs>>, email: string): Promise<string> {
  const { data, error } = await client.from("employees").select("id").eq("email", email).single();
  if (error || !data) throw new Error(`could not resolve employee id for ${email}`);
  return data.id as string;
}
