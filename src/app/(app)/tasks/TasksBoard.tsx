"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/hooks/queries/useTasks";
import { ALL_CENTRES, isNetworkWideRole } from "@/lib/domain/vocabulary";
import type { AppRole, TaskStatus, TaskView } from "@/lib/data/types";
import { CreateTaskForm } from "./CreateTaskForm";
import { TaskFilters } from "./TaskFilters";
import { KanbanColumns } from "./KanbanColumns";
import { TaskCard } from "./TaskCard";

interface CentreOption {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

function groupByStatus(rows: TaskView[]): Record<TaskStatus, TaskView[]> {
  const grouped: Record<TaskStatus, TaskView[]> = {
    TODO: [], DOING: [], DONE: [], BLOCK: [], RESCHEDULED: [], CANCELLED: [],
  };
  for (const t of rows) grouped[t.status]?.push(t);
  return grouped;
}

export function TasksBoard({
  role,
  centres,
  departments,
}: {
  role: AppRole;
  centres: CentreOption[];
  departments: DepartmentOption[];
}) {
  const [centreId, setCentreId] = useState<string>(ALL_CENTRES);
  const [exitedFilter, setExitedFilter] = useState<TaskStatus | null>(null);
  const showSwitcher = isNetworkWideRole(role);

  const baseFilter = showSwitcher ? { centreId } : {};
  const { data, isLoading, error } = useTasks(
    exitedFilter ? { ...baseFilter, status: exitedFilter } : baseFilter,
  );
  const columns = useMemo(() => groupByStatus(data?.rows ?? []), [data]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Công việc</h1>

      <CreateTaskForm departments={departments} />

      <TaskFilters
        showSwitcher={showSwitcher}
        centreId={centreId}
        onCentreChange={setCentreId}
        centres={centres}
        exitedFilter={exitedFilter}
        onExitedFilterChange={setExitedFilter}
      />

      {isLoading && <p>Đang tải...</p>}
      {error && <p className="text-red-600">{error.message}</p>}

      {data && !exitedFilter && <KanbanColumns columns={columns} />}

      {data && exitedFilter && (
        <div className="flex flex-col gap-2">
          {data.rows.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {data.rows.length === 0 && <p className="text-gray-500">Không có công việc nào.</p>}
        </div>
      )}
    </div>
  );
}
