"use client";

import { useEffect, useState } from "react";
import { useCreateTask } from "@/hooks/mutations/useCreateTask";
import { listAssignableEmployees, type AssignableEmployee } from "@/app/actions/tasks/list-assignable-employees";
import { TASK_GROUPS, PRIORITIES } from "@/lib/data/types";
import { TASK_GROUP_LABEL, PRIORITY_LABEL } from "@/lib/domain/vocabulary";
import { Field } from "./Field";
import { SelectField } from "./SelectField";

interface DepartmentOption {
  id: string;
  name: string;
}

const inputClass = "rounded border px-2 py-1";

function useCreateTaskFormState(initialDepartmentId: string) {
  const [assigneeId, setAssigneeId] = useState("");
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState<(typeof TASK_GROUPS)[number]>(TASK_GROUPS[0]);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("MID");
  const [deadline, setDeadline] = useState("");
  return {
    assigneeId, setAssigneeId, departmentId, setDepartmentId, description, setDescription,
    group, setGroup, priority, setPriority, deadline, setDeadline,
  };
}

/** US3 (T043): create + assign a task, own-centre only (assignee picker is pre-scoped server-side). */
export function CreateTaskForm({ departments }: { departments: DepartmentOption[] }) {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <Field label="Mô tả">
        <input required value={f.description} onChange={(e) => f.setDescription(e.target.value)} className={inputClass} />
      </Field>
      <SelectField
        label="Người phụ trách"
        value={f.assigneeId}
        onChange={f.setAssigneeId}
        options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
      />
      <SelectField
        label="Bộ phận"
        value={f.departmentId}
        onChange={f.setDepartmentId}
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />
      <SelectField
        label="Nhóm"
        value={f.group}
        onChange={(v) => f.setGroup(v as (typeof TASK_GROUPS)[number])}
        options={TASK_GROUPS.map((g) => ({ value: g, label: TASK_GROUP_LABEL[g] }))}
      />
      <SelectField
        label="Ưu tiên"
        value={f.priority}
        onChange={(v) => f.setPriority(v as (typeof PRIORITIES)[number])}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
      />
      <Field label="Hạn hoàn thành">
        <input type="date" required value={f.deadline} onChange={(e) => f.setDeadline(e.target.value)} className={inputClass} />
      </Field>
      <button
        type="submit"
        disabled={createTask.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {createTask.isPending ? "Đang tạo..." : "Tạo công việc"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
