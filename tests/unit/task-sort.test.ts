import { describe, it, expect } from "vitest";
import { sortTasks } from "@/services/task-sort";
import type { TaskView } from "@/lib/data/types";

function makeTask(overrides: Partial<TaskView>): TaskView {
  return {
    id: "id",
    centreId: "c1",
    assigneeId: "a1",
    departmentId: "d1",
    description: "desc",
    group: "KHAC",
    priority: "MID",
    deadline: "2026-01-01",
    status: "TODO",
    source: "SELF_CREATED",
    note: null,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    assigneeName: "A",
    departmentName: "D",
    centreName: "C",
    createdByName: "U",
    ...overrides,
  };
}

describe("task-sort: sortTasks", () => {
  it("sorts by deadline ascending", () => {
    const rows = [
      makeTask({ id: "1", deadline: "2026-03-01" }),
      makeTask({ id: "2", deadline: "2026-01-01" }),
      makeTask({ id: "3", deadline: "2026-02-01" }),
    ];
    const sorted = sortTasks(rows, "deadline", "asc");
    expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by deadline descending", () => {
    const rows = [
      makeTask({ id: "1", deadline: "2026-03-01" }),
      makeTask({ id: "2", deadline: "2026-01-01" }),
    ];
    const sorted = sortTasks(rows, "deadline", "desc");
    expect(sorted.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("sorts by priority HIGH > MID > LOW ascending means HIGH first", () => {
    const rows = [
      makeTask({ id: "1", priority: "LOW" }),
      makeTask({ id: "2", priority: "HIGH" }),
      makeTask({ id: "3", priority: "MID" }),
    ];
    const sorted = sortTasks(rows, "priority", "asc");
    expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("does not mutate the input array", () => {
    const rows = [makeTask({ id: "1", deadline: "2026-03-01" }), makeTask({ id: "2", deadline: "2026-01-01" })];
    const original = [...rows];
    sortTasks(rows, "deadline", "asc");
    expect(rows).toEqual(original);
  });
});
