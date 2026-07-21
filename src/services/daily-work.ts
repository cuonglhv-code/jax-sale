import type { TaskView } from "@/lib/data/types";
import type { EmployeeListRow } from "@/services/task.service";

export interface DailyEmployeeGroup {
  employee: EmployeeListRow;
  tasksToday: TaskView[];
  doneCount: number;
  totalCount: number;
}

/** Pure grouping for the Daily Work view. `today` is injected (ISO `YYYY-MM-DD`) to keep this
 *  testable without mocking the system clock. */
export function groupTasksByEmployeeForToday(
  employees: EmployeeListRow[],
  tasks: TaskView[],
  today: string,
): DailyEmployeeGroup[] {
  return employees.map((employee) => {
    const tasksToday = tasks.filter((t) => t.assigneeId === employee.id && t.deadline === today);
    const doneCount = tasksToday.filter((t) => t.status === "DONE").length;
    return { employee, tasksToday, doneCount, totalCount: tasksToday.length };
  });
}
