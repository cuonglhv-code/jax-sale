import { useChangeTaskStatus } from "@/hooks/mutations/useChangeTaskStatus";
import { TASK_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_COLOR, TASK_GROUP_LABEL, TASK_GROUP_COLOR } from "@/lib/domain/vocabulary";
import type { TaskView } from "@/lib/data/types";
import { nextAutoStatus } from "@/services/task-status";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts.at(-2)?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function isOverdue(deadline: string, status: TaskView["status"]): boolean {
  if (status === "DONE") return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

/** Kanban card (design_handoff_jax_sales): group chip + priority badge, title, assignee avatar +
 *  due date (red when overdue and not done), hover lift/shadow. */
export function TaskCard({ task }: { task: TaskView }) {
  const changeStatus = useChangeTaskStatus();
  const next = nextAutoStatus(task.status);
  const color = PRIORITY_COLOR[task.priority];
  const overdue = isOverdue(task.deadline, task.status);

  return (
    <article className="group flex flex-col gap-[11px] rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-md">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-text-muted">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: TASK_GROUP_COLOR[task.group] }} />
          {TASK_GROUP_LABEL[task.group]}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
          style={{ color: color.text, background: color.bg, borderColor: color.border }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      <p className="m-0 text-[13.5px] font-semibold leading-[1.35] text-text">{task.description}</p>

      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[10.5px] font-bold text-navy">
          {initials(task.assigneeName)}
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted">
          {task.assigneeName}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-medium"
          style={{ color: overdue ? "var(--color-red)" : "var(--color-text-muted)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {new Date(task.deadline).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
        </span>
      </div>

      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        {next && (
          <button
            onClick={() => changeStatus.mutate({ taskId: task.id })}
            disabled={changeStatus.isPending}
            className="rounded-md bg-navy px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
          >
            → {TASK_STATUS_LABEL[next]}
          </button>
        )}
        {task.status === "BLOCK" ? (
          <button
            onClick={() => changeStatus.mutate({ taskId: task.id, target: "TODO" })}
            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-surface-3"
          >
            Bỏ chặn
          </button>
        ) : (
          <button
            onClick={() => changeStatus.mutate({ taskId: task.id, target: "BLOCK" })}
            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-surface-3"
          >
            Tạm dừng
          </button>
        )}
      </div>
      {changeStatus.isError && <p className="text-[11px] text-red">{(changeStatus.error as Error).message}</p>}
    </article>
  );
}
