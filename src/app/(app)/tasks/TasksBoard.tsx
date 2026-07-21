"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTasks } from "@/hooks/queries/useTasks";
import { ALL_CENTRES, isNetworkWideRole } from "@/lib/domain/vocabulary";
import type { AppRole, TaskStatus, TaskView } from "@/lib/data/types";
import { CreateTaskDrawer } from "./CreateTaskDrawer";
import { TaskFilters } from "./TaskFilters";
import { KanbanColumns } from "./KanbanColumns";
import { TaskCard } from "./TaskCard";

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

/** Centre scope now comes from the shell's `?centre=` param (CentreSwitcher, layout.tsx) rather
 *  than a page-local dropdown — see design_handoff_jax_sales step 4. */
export function TasksBoard({
  role,
  departments,
}: {
  role: AppRole;
  departments: DepartmentOption[];
}) {
  const [exitedFilter, setExitedFilter] = useState<TaskStatus | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "HIGH" | "MID" | "LOW">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const searchParams = useSearchParams();
  const showSwitcher = isNetworkWideRole(role);
  const centreId = searchParams.get("centre") ?? ALL_CENTRES;

  const baseFilter = showSwitcher ? { centreId } : {};
  const { data, isLoading, error } = useTasks(
    exitedFilter ? { ...baseFilter, status: exitedFilter } : baseFilter,
  );

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter(
      (t) =>
        (priorityFilter === "all" || t.priority === priorityFilter) &&
        (!q || t.description.toLowerCase().includes(q) || t.assigneeName.toLowerCase().includes(q)),
    );
  }, [data, search, priorityFilter]);

  const columns = useMemo(() => groupByStatus(filteredRows), [filteredRows]);

  return (
    <div className="flex flex-col gap-[18px] px-6 py-5 pb-7">
      <TaskFilters
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        search={search}
        onSearchChange={setSearch}
        exitedFilter={exitedFilter}
        onExitedFilterChange={setExitedFilter}
        visibleCount={filteredRows.length}
        totalCount={data?.rows.length ?? 0}
        onOpenCreate={() => setCreateOpen(true)}
      />

      {isLoading && <p className="text-text-muted">Đang tải...</p>}
      {error && <p className="text-red">{error.message}</p>}

      {data && !exitedFilter && <KanbanColumns columns={columns} />}

      {data && exitedFilter && (
        <div className="flex flex-col gap-2">
          {filteredRows.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {filteredRows.length === 0 && <p className="text-text-muted">Không có công việc nào.</p>}
        </div>
      )}

      <CreateTaskDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} departments={departments} />
    </div>
  );
}
