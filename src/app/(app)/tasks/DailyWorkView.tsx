"use client";

import { useState } from "react";
import { useEmployees } from "@/hooks/queries/useEmployees";
import { groupTasksByEmployeeForToday } from "@/services/daily-work";
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR } from "@/lib/domain/vocabulary";
import { initials } from "@/lib/format";
import type { TaskView } from "@/lib/data/types";

/** Per-employee "who's on track today" checklist (superpowers brainstorm 2026-07-21). */
export function DailyWorkView({ rows, centreId }: { rows: TaskView[]; centreId?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: employees, isLoading, error } = useEmployees(centreId ? { centreId } : {});
  const today = new Date().toISOString().slice(0, 10);

  if (isLoading) return <p className="text-text-muted">Đang tải...</p>;
  if (error) return <p className="text-red">{error.message}</p>;

  const groups = groupTasksByEmployeeForToday(employees ?? [], rows, today);

  if (groups.length === 0) {
    return <p className="text-text-muted">Không có nhân sự phù hợp.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((group) => {
        const pct = group.totalCount === 0 ? 0 : Math.round((group.doneCount / group.totalCount) * 100);
        const isExpanded = expandedId === group.employee.id;
        return (
          <div key={group.employee.id} className="rounded-[var(--radius-panel)] border border-border bg-surface-2">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : group.employee.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: group.employee.avatarColor }}
              >
                {initials(group.employee.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13px] font-semibold text-text">{group.employee.fullName}</p>
                <p className="m-0 text-[11.5px] text-text-muted">{group.employee.departmentName}</p>
              </div>
              <div className="flex w-32 shrink-0 flex-col items-end gap-1">
                <span className="text-[11.5px] font-medium text-text-muted">
                  {group.doneCount}/{group.totalCount} hoàn thành
                </span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="flex flex-col gap-1.5 border-t border-border px-4 py-3">
                {group.tasksToday.length === 0 && (
                  <p className="m-0 text-[12px] text-text-faint">Không có công việc nào hôm nay.</p>
                )}
                {group.tasksToday.map((task) => {
                  const color = TASK_STATUS_COLOR[task.status];
                  return (
                    <div key={task.id} className="flex items-center gap-2 text-[12.5px]">
                      <span
                        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11px] font-semibold"
                        style={{ color: color.text, background: color.bg, borderColor: color.border }}
                      >
                        {TASK_STATUS_LABEL[task.status]}
                      </span>
                      <span className="text-text">{task.description}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
