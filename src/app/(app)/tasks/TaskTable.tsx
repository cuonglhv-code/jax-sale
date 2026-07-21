"use client";

import { useState } from "react";
import { useChangeTaskStatus } from "@/hooks/mutations/useChangeTaskStatus";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_COLOR,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  TASK_GROUP_LABEL,
  TASK_GROUP_COLOR,
} from "@/lib/domain/vocabulary";
import { TASK_STATUSES } from "@/lib/data/types";
import type { TaskView, TaskStatus } from "@/lib/data/types";
import { nextAutoStatus } from "@/services/task-status";
import { sortTasks, type TaskSortKey, type SortDirection } from "@/services/task-sort";
import { initials } from "@/lib/format";

function isOverdue(deadline: string, status: TaskStatus): boolean {
  if (status === "DONE") return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

function StatusPill({ task }: { task: TaskView }) {
  const changeStatus = useChangeTaskStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const color = TASK_STATUS_COLOR[task.status];
  const next = nextAutoStatus(task.status);

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        disabled={changeStatus.isPending || next === null}
        onClick={() => next && changeStatus.mutate({ taskId: task.id })}
        title={next ? `Chuyển sang ${TASK_STATUS_LABEL[next]}` : "Không thể tự động chuyển trạng thái"}
        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px] disabled:cursor-not-allowed"
        style={{ color: color.text, background: color.bg, borderColor: color.border }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
        {TASK_STATUS_LABEL[task.status]}
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="text-text-faint hover:text-text-muted"
        aria-label="Chọn trạng thái khác"
      >
        ⋯
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-full z-10 mt-1 flex flex-col rounded-md border border-border bg-surface py-1 shadow-md">
          {TASK_STATUSES.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                changeStatus.mutate({ taskId: task.id, target: s });
                setMenuOpen(false);
              }}
              className="whitespace-nowrap px-3 py-1 text-left text-[12px] text-text hover:bg-surface-3"
            >
              {TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      {changeStatus.isError && <p className="text-[11px] text-red">{(changeStatus.error as Error).message}</p>}
    </div>
  );
}

/** Dense sortable task table — replaces the Kanban board (superpowers brainstorm 2026-07-21). */
export function TaskTable({ rows }: { rows: TaskView[] }) {
  const [sortKey, setSortKey] = useState<TaskSortKey>("deadline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sorted = sortTasks(rows, sortKey, sortDirection);

  function toggleSort(key: TaskSortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <table className="min-w-[900px] w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="px-3 py-2 font-semibold">Trạng thái</th>
            <th
              className="cursor-pointer px-3 py-2 font-semibold"
              onClick={() => toggleSort("priority")}
            >
              Ưu tiên {sortKey === "priority" && (sortDirection === "asc" ? "↑" : "↓")}
            </th>
            <th className="px-3 py-2 font-semibold">Nhóm</th>
            <th className="px-3 py-2 font-semibold">Công việc</th>
            <th className="px-3 py-2 font-semibold">Người phụ trách</th>
            <th className="px-3 py-2 font-semibold">Bộ phận</th>
            <th
              className="cursor-pointer px-3 py-2 font-semibold"
              onClick={() => toggleSort("deadline")}
            >
              Hạn {sortKey === "deadline" && (sortDirection === "asc" ? "↑" : "↓")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task, i) => {
            const overdue = isOverdue(task.deadline, task.status);
            const priorityColor = PRIORITY_COLOR[task.priority];
            return (
              <tr
                key={task.id}
                className={`border-b border-border ${i % 2 === 0 ? "bg-surface" : "bg-surface-2"}`}
              >
                <td className="px-3 py-[9px]">
                  <StatusPill task={task} />
                </td>
                <td className="px-3 py-[9px]">
                  <span
                    className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold"
                    style={{ color: priorityColor.text, background: priorityColor.bg, borderColor: priorityColor.border }}
                  >
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </td>
                <td className="px-3 py-[9px]">
                  <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-text-muted">
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: TASK_GROUP_COLOR[task.group] }} />
                    {TASK_GROUP_LABEL[task.group]}
                  </span>
                </td>
                <td className="px-3 py-[9px] font-medium text-text">{task.description}</td>
                <td className="px-3 py-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[10.5px] font-bold text-navy">
                      {initials(task.assigneeName)}
                    </span>
                    <span className="text-text-muted">{task.assigneeName}</span>
                  </div>
                </td>
                <td className="px-3 py-[9px] text-text-muted">{task.departmentName}</td>
                <td className="px-3 py-[9px]">
                  <span style={{ color: overdue ? "var(--color-red)" : "var(--color-text-muted)" }}>
                    {new Date(task.deadline).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-text-faint">
                Không có công việc phù hợp bộ lọc
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
