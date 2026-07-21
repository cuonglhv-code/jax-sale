import type { TaskView, Priority } from "@/lib/data/types";

export type TaskSortKey = "deadline" | "priority";
export type SortDirection = "asc" | "desc";

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MID: 1, LOW: 2 };

/** Pure, non-mutating sort for the Task Table view. */
export function sortTasks(rows: TaskView[], key: TaskSortKey, direction: SortDirection): TaskView[] {
  const sorted = [...rows].sort((a, b) => {
    const cmp =
      key === "deadline"
        ? a.deadline.localeCompare(b.deadline)
        : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}
