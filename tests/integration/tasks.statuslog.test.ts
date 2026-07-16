import { describe, it, expect } from "vitest";
import { createTaskCore, changeTaskStatusCore } from "@/services/task.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { SEEDED_USERS, SEED_DEPT_TEACHER, SEED_EMPLOYEE_TEACHER_Q1, signInAs } from "../helpers/auth";

/** US4 (T045): every status change (incl. creation) writes exactly one log row (FR-021, SC-004). */
describe("tasks: status log completeness", () => {
  it("logs the automatic TODO->DOING->DONE->TODO cycle, one row per transition", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertPermission(client, "task.create");
    const task = await createTaskCore(client, claims, {
      assigneeId: SEED_EMPLOYEE_TEACHER_Q1,
      departmentId: SEED_DEPT_TEACHER,
      description: "STATUSLOG-PROBE-CYCLE",
      group: "GIANG_DAY",
      priority: "LOW",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    await changeTaskStatusCore(client, claims, { taskId: task.id }); // TODO -> DOING
    await changeTaskStatusCore(client, claims, { taskId: task.id }); // DOING -> DONE
    await changeTaskStatusCore(client, claims, { taskId: task.id }); // DONE -> TODO

    const logs = await client
      .from("task_status_logs")
      .select("from_status, to_status")
      .eq("task_id", task.id)
      .order("changed_at", { ascending: true });

    // 1 (creation) + 3 (cycle) = 4 total; each is exactly one row per transition.
    expect(logs.data?.length).toBe(4);
    expect(logs.data?.map((l) => [l.from_status, l.to_status])).toEqual([
      [null, "TODO"],
      ["TODO", "DOING"],
      ["DOING", "DONE"],
      ["DONE", "TODO"],
    ]);
  });

  it("logs an explicit BLOCK then an explicit exit, and never auto-cycles through BLOCK", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertPermission(client, "task.create");
    const task = await createTaskCore(client, claims, {
      assigneeId: SEED_EMPLOYEE_TEACHER_Q1,
      departmentId: SEED_DEPT_TEACHER,
      description: "STATUSLOG-PROBE-BLOCK",
      group: "GIANG_DAY",
      priority: "LOW",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    await changeTaskStatusCore(client, claims, { taskId: task.id, target: "BLOCK" });
    await expect(changeTaskStatusCore(client, claims, { taskId: task.id })).rejects.toThrow(); // no auto exit
    await changeTaskStatusCore(client, claims, { taskId: task.id, target: "TODO" });

    const logs = await client
      .from("task_status_logs")
      .select("from_status, to_status")
      .eq("task_id", task.id)
      .order("changed_at", { ascending: true });

    expect(logs.data?.map((l) => [l.from_status, l.to_status])).toEqual([
      [null, "TODO"],
      ["TODO", "BLOCK"],
      ["BLOCK", "TODO"],
    ]);
  });
});
