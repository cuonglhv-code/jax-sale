"use client";

import { useState } from "react";
import { useRescheduleTask } from "@/hooks/mutations/useRescheduleTask";
import { useChangeTaskStatus } from "@/hooks/mutations/useChangeTaskStatus";
import { TASK_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_COLOR, TASK_GROUP_LABEL, TASK_GROUP_COLOR } from "@/lib/domain/vocabulary";
import { nextAutoStatus } from "@/services/task-status";
import type { TaskView } from "@/lib/data/types";

const selectClass =
  "h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]";

export function TaskDetailDrawer({
  task,
  isOpen,
  onClose,
}: {
  task: TaskView | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const reschedule = useRescheduleTask();
  const changeStatus = useChangeTaskStatus();

  if (!isOpen || !task) return null;

  const color = PRIORITY_COLOR[task.priority];
  const next = nextAutoStatus(task.status);

  function handleDeadlineSave() {
    if (deadline && deadline !== task!.deadline) {
      reschedule.mutate(
        { taskId: task!.id, newDeadline: deadline },
        { onSuccess: () => onClose() },
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(10,14,30,.5)] backdrop-blur-[2px]" />
      <div className="relative flex h-full w-[440px] max-w-[92vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-lg">
        <div className="sticky top-0 z-[2] flex items-center gap-2.5 border-b border-border bg-surface px-5 py-[18px]">
          <span className="h-5 w-[3px] rounded-sm bg-red" />
          <h2 className="m-0 text-base font-bold text-text">Chi tiết công việc</h2>
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

        <div className="flex flex-1 flex-col gap-4 p-5">
          <p className="m-0 text-[15px] font-semibold leading-[1.4] text-text">{task.description}</p>

          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold"
              style={{ color: color.text, background: color.bg, borderColor: color.border }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
              {PRIORITY_LABEL[task.priority]}
            </span>
            <span
              className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold"
              style={{
                color: TASK_GROUP_COLOR[task.group],
                background: `${TASK_GROUP_COLOR[task.group]}15`,
                borderColor: `${TASK_GROUP_COLOR[task.group]}40`,
              }}
            >
              {TASK_GROUP_LABEL[task.group]}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Trạng thái</span>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold"
                style={{
                  color: `var(--color-st-${task.status.toLowerCase().replace("_", "-")}-text, var(--color-text-muted))`,
                  background: `var(--color-st-${task.status.toLowerCase().replace("_", "-")}-bg, var(--color-surface-2))`,
                  borderColor: `var(--color-st-${task.status.toLowerCase().replace("_", "-")}-border, var(--color-border))`,
                }}
              >
                {TASK_STATUS_LABEL[task.status]}
              </span>
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
              ) : task.status !== "DONE" && task.status !== "CANCELLED" && (
                <button
                  onClick={() => changeStatus.mutate({ taskId: task.id, target: "BLOCK" })}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-surface-3"
                >
                  Tạm dừng
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Người phụ trách</span>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[10.5px] font-bold text-navy">
                {task.assigneeName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[13.5px] text-text">{task.assigneeName}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Bộ phận</span>
            <span className="text-[13.5px] text-text">{task.departmentName}</span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Hạn chót</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={selectClass}
            />
          </label>

          {deadline !== task.deadline && (
            <button
              onClick={handleDeadlineSave}
              disabled={reschedule.isPending}
              className="h-10 rounded-[var(--radius-field)] bg-navy text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
            >
              {reschedule.isPending ? "Đang lưu..." : "Cập nhật hạn"}
            </button>
          )}

          {reschedule.isError && <p className="text-[12.5px] text-red">{(reschedule.error as Error).message}</p>}
          {changeStatus.isError && <p className="text-[12.5px] text-red">{(changeStatus.error as Error).message}</p>}
        </div>
      </div>
    </div>
  );
}
