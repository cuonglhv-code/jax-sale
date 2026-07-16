import { describe, it, expect } from "vitest";
import { createTaskCore, assignTaskCore } from "@/services/task.service";
import { assertPermission } from "@/lib/auth/assert-permission";
import { SEEDED_USERS, SEED_DEPT_TEACHER, SEED_EMPLOYEE_TEACHER_Q1, signInAs } from "../helpers/auth";

/**
 * US3 (T038): create writes an initial null→TODO status log (FR-022) + one `task.create` audit
 * entry (FR-024g, SC-004a); assign writes a `task.assign` audit entry.
 */
describe("tasks: create/assign — logs & audit", () => {
  it("create writes the initial null→TODO status log and exactly one task.create audit entry", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertPermission(client, "task.create");

    const task = await createTaskCore(client, claims, {
      assigneeId: SEED_EMPLOYEE_TEACHER_Q1,
      departmentId: SEED_DEPT_TEACHER,
      description: "AUDIT-PROBE-CREATE",
      group: "GIANG_DAY",
      priority: "MID",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    const logs = await client.from("task_status_logs").select("*").eq("task_id", task.id);
    expect(logs.data?.length).toBe(1);
    expect(logs.data?.[0].from_status).toBeNull();
    expect(logs.data?.[0].to_status).toBe("TODO");

    const audits = await client
      .from("audit_log")
      .select("*")
      .eq("entity_id", task.id)
      .eq("action", "task.create");
    expect(audits.data?.length).toBe(1);
  });

  it("assign writes a task.assign audit entry", async () => {
    const client = await signInAs(SEEDED_USERS.managerQ1);
    const claims = await assertPermission(client, "task.create");

    const task = await createTaskCore(client, claims, {
      assigneeId: SEED_EMPLOYEE_TEACHER_Q1,
      departmentId: SEED_DEPT_TEACHER,
      description: "AUDIT-PROBE-ASSIGN",
      group: "GIANG_DAY",
      priority: "MID",
      deadline: "2026-12-31",
      source: "SELF_CREATED",
    });

    await assignTaskCore(client, claims, { taskId: task.id, assigneeId: SEED_EMPLOYEE_TEACHER_Q1 });

    const audits = await client
      .from("audit_log")
      .select("*")
      .eq("entity_id", task.id)
      .eq("action", "task.assign");
    expect(audits.data?.length).toBe(1);
  });
});
