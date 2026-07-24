"use client";

import { TASK_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_COLOR } from "@/lib/domain/vocabulary";
import type { TaskView } from "@/lib/data/types";

export function DayTaskList({
  date,
  tasks,
  onSelectTask,
  onClose,
}: {
  date: Date;
  tasks: TaskView[];
  onSelectTask: (task: TaskView) => void;
  onClose: () => void;
}) {
  const dateStr = date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(10,14,30,.5)] backdrop-blur-[2px]" />
      <div className="relative flex h-full w-[400px] max-w-[92vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-lg">
        <div className="sticky top-0 z-[2] flex items-center gap-2.5 border-b border-border bg-surface px-5 py-[18px]">
          <span className="h-5 w-[3px] rounded-sm bg-navy" />
          <h2 className="m-0 text-base font-bold text-text capitalize">{dateStr}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-2 p-5">
          {tasks.length === 0 && (
            <p className="text-[13.5px] text-text-muted">Không có công việc nào trong ngày.</p>
          )}
          {tasks.map((task) => {
            const color = PRIORITY_COLOR[task.priority];
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task)}
                className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-border bg-surface p-3 text-left transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-md"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold"
                    style={{ color: color.text, background: color.bg, borderColor: color.border }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                  <span
                    className="ml-auto text-[11.5px] font-medium"
                    style={{
                      color: `var(--color-st-${task.status.toLowerCase().replace("_", "-")}-text, var(--color-text-muted))`,
                    }}
                  >
                    {TASK_STATUS_LABEL[task.status]}
                  </span>
                </div>
                <p className="m-0 text-[13.5px] font-semibold text-text">{task.description}</p>
                <span className="text-[12px] text-text-muted">{task.assigneeName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
