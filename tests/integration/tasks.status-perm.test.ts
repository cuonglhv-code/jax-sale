import { describe, it, expect } from "vitest";
import { createTaskCore, changeTaskStatusCore } from "@/services/task.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { SEEDED_USERS, SEED_DEPT_TEACHER, SEED_EMPLOYEE_TEACHER_Q1, signInAs } from "../helpers/auth";

/**
 * US4 (T046): a status change outside the caller's permitted scope is refused with NO log written
 * (SC-001, spec US4 acceptance scenario 5). Scope here = a teacher may only change status on tasks
 * assigned to them (a natural extension of FR-017's own-tasks-only rule to writes).
 */
describe("tasks: status-change scope rejection", () => {
  it("refuses a teacher changing the status of a task NOT assigned to them, and writes no log", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "task.create");

    // A task assigned to the manager themself (not the teacher).
    const managerEmployeeId = (
      await managerClient.from("employees").select("id").eq("email", SEEDED_USERS.managerQ1).single()
    ).data?.id as string;

    const task = await createTaskCore(managerClient, managerClaims, {
      assigneeId: managerEmployeeId,
      departmentId: SEED_DEPT_TEACHER,
      description: "STATUS-PERM-PROBE-NOT-MINE",
      group: "GIANG_DAY",
      priority: "LOW",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    const teacherClient = await signInAs(SEEDED_USERS.teacherQ1);
    const teacherClaims = await assertPermission(teacherClient, "task.changeStatus");

    await expect(
      changeTaskStatusCore(teacherClient, teacherClaims, { taskId: task.id }),
    ).rejects.toThrow();

    const logs = await managerClient
      .from("task_status_logs")
      .select("id")
      .eq("task_id", task.id);
    expect(logs.data?.length).toBe(1); // only the creation log — no log from the rejected attempt
  });

  it("allows the teacher to change status of a task assigned to them", async () => {
    const managerClient = await signInAs(SEEDED_USERS.managerQ1);
    const managerClaims = await assertPermission(managerClient, "task.create");
    const task = await createTaskCore(managerClient, managerClaims, {
      assigneeId: SEED_EMPLOYEE_TEACHER_Q1,
      departmentId: SEED_DEPT_TEACHER,
      description: "STATUS-PERM-PROBE-MINE",
      group: "GIANG_DAY",
      priority: "LOW",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    const teacherClient = await signInAs(SEEDED_USERS.teacherQ1);
    const teacherClaims = await assertPermission(teacherClient, "task.changeStatus");
    const updated = await changeTaskStatusCore(teacherClient, teacherClaims, { taskId: task.id });
    expect(updated.status).toBe("DOING");
  });
});
