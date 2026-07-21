import { describe, it, expect } from "vitest";
import { groupTasksByEmployeeForToday } from "@/services/daily-work";
import type { TaskView } from "@/lib/data/types";
import type { EmployeeListRow } from "@/services/task.service";

function makeEmployee(overrides: Partial<EmployeeListRow>): EmployeeListRow {
  return { id: "e1", fullName: "Nguyễn Văn A", departmentId: "d1", departmentName: "Giảng dạy", avatarColor: "#000", ...overrides };
}

function makeTask(overrides: Partial<TaskView>): TaskView {
  return {
    id: "t1", centreId: "c1", assigneeId: "e1", departmentId: "d1", description: "desc",
    group: "KHAC", priority: "MID", deadline: "2026-07-21", status: "TODO", source: "SELF_CREATED",
    note: null, createdBy: "u1", createdAt: "2026-07-21T00:00:00Z", assigneeName: "Nguyễn Văn A",
    departmentName: "D", centreName: "C", createdByName: "U", ...overrides,
  };
}

describe("daily-work: groupTasksByEmployeeForToday", () => {
  it("groups only today's tasks under each employee", () => {
    const employees = [makeEmployee({ id: "e1" })];
    const tasks = [
      makeTask({ id: "t1", assigneeId: "e1", deadline: "2026-07-21" }),
      makeTask({ id: "t2", assigneeId: "e1", deadline: "2026-07-22" }), // not today
    ];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups).toHaveLength(1);
    expect(groups[0].tasksToday.map((t) => t.id)).toEqual(["t1"]);
  });

  it("includes employees with zero tasks today", () => {
    const employees = [makeEmployee({ id: "e1" }), makeEmployee({ id: "e2", fullName: "B" })];
    const tasks = [makeTask({ id: "t1", assigneeId: "e1", deadline: "2026-07-21" })];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups).toHaveLength(2);
    const e2Group = groups.find((g) => g.employee.id === "e2");
    expect(e2Group?.tasksToday).toEqual([]);
    expect(e2Group?.totalCount).toBe(0);
  });

  it("computes doneCount/totalCount for today's tasks", () => {
    const employees = [makeEmployee({ id: "e1" })];
    const tasks = [
      makeTask({ id: "t1", assigneeId: "e1", deadline: "2026-07-21", status: "DONE" }),
      makeTask({ id: "t2", assigneeId: "e1", deadline: "2026-07-21", status: "TODO" }),
      makeTask({ id: "t3", assigneeId: "e1", deadline: "2026-07-21", status: "DOING" }),
    ];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups[0].doneCount).toBe(1);
    expect(groups[0].totalCount).toBe(3);
  });

  it("ignores tasks whose assignee is not in the employees list", () => {
    const employees = [makeEmployee({ id: "e1" })];
    const tasks = [makeTask({ id: "t1", assigneeId: "unknown-employee", deadline: "2026-07-21" })];
    const groups = groupTasksByEmployeeForToday(employees, tasks, "2026-07-21");
    expect(groups[0].tasksToday).toEqual([]);
  });
});
