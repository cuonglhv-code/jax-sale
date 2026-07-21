"use client";

import { useEffect, useState } from "react";
import { useCreateTask } from "@/hooks/mutations/useCreateTask";
import { listAssignableEmployees, type AssignableEmployee } from "@/app/actions/tasks/list-assignable-employees";
import { TASK_GROUPS, PRIORITIES } from "@/lib/data/types";
import type { TaskGroup, Priority } from "@/lib/data/types";
import { TASK_GROUP_LABEL, PRIORITY_LABEL } from "@/lib/domain/vocabulary";

interface DepartmentOption {
  id: string;
  name: string;
}

const selectClass =
  "h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]";

function useCreateTaskFormState(initialDepartmentId: string) {
  const [assigneeId, setAssigneeId] = useState("");
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState<TaskGroup>(TASK_GROUPS[0]);
  const [priority, setPriority] = useState<Priority>("MID");
  const [deadline, setDeadline] = useState("");
  return {
    assigneeId, setAssigneeId, departmentId, setDepartmentId, description, setDescription,
    group, setGroup, priority, setPriority, deadline, setDeadline,
  };
}

/** US3 (T043): create + assign a task, own-centre only (assignee picker is pre-scoped
 *  server-side). A slide-over drawer over a blurred backdrop, matching design_handoff_jax_sales'
 *  "Tạo công việc mới" panel — replaces the previous inline CreateTaskForm. */
export function CreateTaskDrawer({
  isOpen,
  onClose,
  departments,
}: {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentOption[];
}) {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const f = useCreateTaskFormState(departments[0]?.id ?? "");
  const createTask = useCreateTask();

  useEffect(() => {
    listAssignableEmployees().then((result) => {
      if ("data" in result) {
        setEmployees(result.data);
        if (result.data[0]) f.setAssigneeId(result.data[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.description.trim()) {
      setTitleError(true);
      return;
    }
    setError(null);
    try {
      await createTask.mutateAsync({
        assigneeId: f.assigneeId,
        departmentId: f.departmentId,
        description: f.description,
        group: f.group,
        priority: f.priority,
        deadline: f.deadline,
        source: "SELF_CREATED",
      });
      f.setDescription("");
      f.setDeadline("");
      setTitleError(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(10,14,30,.5)] backdrop-blur-[2px]" />
      <div className="relative flex h-full w-[440px] max-w-[92vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-lg">
        <div className="sticky top-0 z-[2] flex items-center gap-2.5 border-b border-border bg-surface px-5 py-[18px]">
          <span className="h-5 w-[3px] rounded-sm bg-red" />
          <h2 className="m-0 text-base font-bold text-text">Tạo công việc mới</h2>
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

        <form id="create-task-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">
              Tiêu đề <span className="text-red">*</span>
            </span>
            <input
              value={f.description}
              onChange={(e) => {
                f.setDescription(e.target.value);
                setTitleError(false);
              }}
              placeholder="VD: Gọi lại phụ huynh lớp Movers"
              className={`h-10 rounded-[var(--radius-field)] border px-[11px] text-[13.5px] text-text outline-none transition-[border-color,box-shadow] ${
                titleError
                  ? "border-red shadow-[0_0_0_3px_var(--color-red-tint)]"
                  : "border-border bg-surface-2 focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
              }`}
            />
            {titleError && (
              <span className="flex items-center gap-1 text-[11.5px] font-medium text-red-dark">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                Vui lòng nhập tiêu đề công việc
              </span>
            )}
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-text">Nhóm</span>
              <select value={f.group} onChange={(e) => f.setGroup(e.target.value as TaskGroup)} className={selectClass}>
                {TASK_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {TASK_GROUP_LABEL[g]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-text">Hạn chót</span>
              <input
                type="date"
                required
                value={f.deadline}
                onChange={(e) => f.setDeadline(e.target.value)}
                className={selectClass}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Mức ưu tiên</span>
            <div className="inline-flex gap-[3px] rounded-[var(--radius-field)] border border-border bg-surface-3 p-[3px]">
              {PRIORITIES.map((p) => {
                const active = f.priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => f.setPriority(p)}
                    className="h-8 flex-1 rounded-md text-[12.5px] font-semibold transition-all"
                    style={{
                      background: active ? `var(--color-pri-${p.toLowerCase()}-bg)` : "transparent",
                      color: active ? `var(--color-pri-${p.toLowerCase()}-text)` : "var(--color-text-muted)",
                      boxShadow: active ? `inset 0 0 0 1px var(--color-pri-${p.toLowerCase()}-border)` : "none",
                    }}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Người phụ trách</span>
            <select value={f.assigneeId} onChange={(e) => f.setAssigneeId(e.target.value)} className={selectClass}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Bộ phận</span>
            <select value={f.departmentId} onChange={(e) => f.setDepartmentId(e.target.value)} className={selectClass}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-[12.5px] text-red">{error}</p>}
        </form>

        <div className="sticky bottom-0 flex gap-2.5 border-t border-border bg-surface px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-[42px] flex-1 rounded-[var(--radius-field)] border border-border bg-surface-2 text-[13.5px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-3"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="create-task-form"
            disabled={createTask.isPending}
            className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[var(--radius-field)] bg-navy text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-80"
          >
            {createTask.isPending ? "Đang tạo…" : "Tạo công việc"}
          </button>
        </div>
      </div>
    </div>
  );
}
