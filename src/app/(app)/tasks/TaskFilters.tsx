import { TASK_STATUS_LABEL } from "@/lib/domain/vocabulary";
import type { TaskStatus, Priority } from "@/lib/data/types";

const EXITED_STATUSES: TaskStatus[] = ["RESCHEDULED", "CANCELLED"];

const PRIORITY_FILTERS: { key: "all" | Priority; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "HIGH", label: "Cao" },
  { key: "MID", label: "Trung bình" },
  { key: "LOW", label: "Thấp" },
];

interface TaskFiltersProps {
  priorityFilter: "all" | Priority;
  onPriorityFilterChange: (value: "all" | Priority) => void;
  search: string;
  onSearchChange: (value: string) => void;
  exitedFilter: TaskStatus | null;
  onExitedFilterChange: (value: TaskStatus | null) => void;
  visibleCount: number;
  totalCount: number;
  onOpenCreate: () => void;
}

/** Segmented priority filter (dot + active navy state) + live count + "Tạo công việc" — the
 *  handoff's filter bar. Search input lives in the shell's TopBar; the exited-status view toggle
 *  is a secondary select since it's not part of the handoff's mocked scope but is real app
 *  behavior (RESCHEDULED/CANCELLED tasks aren't board columns). */
export function TaskFilters({
  priorityFilter,
  onPriorityFilterChange,
  search,
  onSearchChange,
  exitedFilter,
  onExitedFilterChange,
  visibleCount,
  totalCount,
  onOpenCreate,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {PRIORITY_FILTERS.map((p) => {
        const active = priorityFilter === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onPriorityFilterChange(p.key)}
            className={`inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-[12.5px] font-semibold transition-all ${
              active
                ? "border-navy bg-surface text-navy shadow-[0_0_0_3px_var(--color-navy-tint)]"
                : "border-border bg-transparent text-text-muted"
            }`}
          >
            {p.label}
            {p.key !== "all" && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `var(--color-pri-${p.key.toLowerCase()}-text)` }}
              />
            )}
          </button>
        );
      })}

      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Tìm công việc, người phụ trách…"
        className="h-[34px] w-[220px] rounded-lg border border-border bg-surface-2 px-3 text-[12.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
      />

      <select
        value={exitedFilter ?? ""}
        onChange={(e) => onExitedFilterChange((e.target.value || null) as TaskStatus | null)}
        className="h-[34px] rounded-lg border border-border bg-surface-2 px-3 text-[12.5px] text-text outline-none"
      >
        <option value="">Bảng (Cần làm / Đang làm / Hoàn thành / Tạm dừng)</option>
        {EXITED_STATUSES.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />
        </svg>
        <span>
          {visibleCount} / {totalCount} công việc
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenCreate}
        className="inline-flex h-[38px] items-center gap-[7px] rounded-[var(--radius-field)] bg-navy px-[15px] text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-navy-dark"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Tạo công việc
      </button>
    </div>
  );
}
