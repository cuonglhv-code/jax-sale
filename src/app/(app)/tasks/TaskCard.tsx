import { useChangeTaskStatus } from "@/hooks/mutations/useChangeTaskStatus";
import { TASK_STATUS_LABEL, PRIORITY_LABEL } from "@/lib/domain/vocabulary";
import type { TaskView } from "@/lib/data/types";
import { nextAutoStatus } from "@/services/task-status";

export function TaskCard({ task }: { task: TaskView }) {
  const changeStatus = useChangeTaskStatus();
  const next = nextAutoStatus(task.status);

  return (
    <div className="rounded border bg-white p-3 shadow-sm">
      <p className="text-sm font-medium">{task.description}</p>
      <p className="text-xs text-gray-500">
        {task.assigneeName} · {PRIORITY_LABEL[task.priority]}
      </p>
      <div className="mt-2 flex gap-2">
        {next && (
          <button
            onClick={() => changeStatus.mutate({ taskId: task.id })}
            disabled={changeStatus.isPending}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            → {TASK_STATUS_LABEL[next]}
          </button>
        )}
        {task.status === "BLOCK" ? (
          <button
            onClick={() => changeStatus.mutate({ taskId: task.id, target: "TODO" })}
            className="rounded border px-2 py-1 text-xs"
          >
            Bỏ chặn
          </button>
        ) : (
          <button
            onClick={() => changeStatus.mutate({ taskId: task.id, target: "BLOCK" })}
            className="rounded border px-2 py-1 text-xs"
          >
            Tạm dừng
          </button>
        )}
      </div>
      {changeStatus.isError && (
        <p className="mt-1 text-xs text-red-600">{(changeStatus.error as Error).message}</p>
      )}
    </div>
  );
}
