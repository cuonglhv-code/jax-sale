import { BOARD_STATUSES } from "@/lib/data/types";
import type { TaskStatus, TaskView } from "@/lib/data/types";
import { TASK_STATUS_LABEL } from "@/lib/domain/vocabulary";
import { TaskCard } from "./TaskCard";

/** The 4-column board (TODO/DOING/DONE/BLOCK) — RESCHEDULED/CANCELLED surface via the status filter. */
export function KanbanColumns({ columns }: { columns: Record<TaskStatus, TaskView[]> }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {BOARD_STATUSES.map((status) => (
        <div key={status} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-600">
            {TASK_STATUS_LABEL[status]} ({columns[status].length})
          </h2>
          {columns[status].map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      ))}
    </div>
  );
}
