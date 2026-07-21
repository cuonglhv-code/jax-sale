import { BOARD_STATUSES } from "@/lib/data/types";
import type { TaskStatus, TaskView } from "@/lib/data/types";
import { TASK_STATUS_LABEL } from "@/lib/domain/vocabulary";
import { TaskCard } from "./TaskCard";

/** Column accent colors (design_handoff_jax_sales): Cần làm=faint, Đang làm=navy, Hoàn thành=green,
 *  Tạm dừng=red — reuses existing tokens rather than a 5th palette. */
const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: "var(--color-text-faint)",
  DOING: "var(--color-navy)",
  DONE: "var(--color-att-ontrack-text)",
  BLOCK: "var(--color-red)",
  RESCHEDULED: "var(--color-st-pending-text)",
  CANCELLED: "var(--color-st-cancelled-text)",
};

/** The 4-column board (TODO/DOING/DONE/BLOCK) — RESCHEDULED/CANCELLED surface via the status
 *  filter. Horizontally-scrollable at narrow widths, per the handoff. */
export function KanbanColumns({ columns }: { columns: Record<TaskStatus, TaskView[]> }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2 pt-0.5">
      <div className="grid min-w-[1010px] items-start gap-3.5" style={{ gridTemplateColumns: "repeat(4, minmax(248px, 1fr))" }}>
        {BOARD_STATUSES.map((status) => {
          const tasks = columns[status];
          const accent = COLUMN_ACCENT[status];
          return (
            <section key={status} className="flex min-h-[180px] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-2">
              <div className="border-t-[3px] rounded-t-[var(--radius-panel)]" style={{ borderColor: accent }} />
              <div className="flex items-center gap-2 px-[13px] pb-2.5 pt-3">
                <span className="h-[9px] w-[9px] rounded-sm" style={{ background: accent }} />
                <h2 className="m-0 text-[13px] font-bold tracking-[.01em] text-text">{TASK_STATUS_LABEL[status]}</h2>
                <span className="ml-auto flex h-5 min-w-[22px] items-center justify-center rounded-full bg-surface-3 px-[7px] text-xs font-semibold text-text-muted">
                  {tasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-[9px] px-2.5 pb-3">
                {tasks.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
                {tasks.length === 0 && (
                  <div className="rounded-[var(--radius-card)] border border-dashed border-border-strong px-3 py-[22px] text-center text-text-faint">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mx-auto mb-1.5 opacity-70"
                    >
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                    <p className="m-0 text-xs">Không có công việc phù hợp bộ lọc</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
