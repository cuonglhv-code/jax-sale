import { ALL_CENTRES, ALL_CENTRES_LABEL, TASK_STATUS_LABEL } from "@/lib/domain/vocabulary";
import type { TaskStatus } from "@/lib/data/types";

interface CentreOption {
  id: string;
  name: string;
}

const EXITED_STATUSES: TaskStatus[] = ["RESCHEDULED", "CANCELLED"];

interface TaskFiltersProps {
  showSwitcher: boolean;
  centreId: string;
  onCentreChange: (value: string) => void;
  centres: CentreOption[];
  exitedFilter: TaskStatus | null;
  onExitedFilterChange: (value: TaskStatus | null) => void;
}

/** Centre switcher (super_admin only, T034) + the board/RESCHEDULED/CANCELLED view toggle. */
export function TaskFilters({
  showSwitcher,
  centreId,
  onCentreChange,
  centres,
  exitedFilter,
  onExitedFilterChange,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {showSwitcher && (
        <select value={centreId} onChange={(e) => onCentreChange(e.target.value)} className="rounded border px-3 py-2">
          <option value={ALL_CENTRES}>{ALL_CENTRES_LABEL}</option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <select
        value={exitedFilter ?? ""}
        onChange={(e) => onExitedFilterChange((e.target.value || null) as TaskStatus | null)}
        className="rounded border px-3 py-2"
      >
        <option value="">Bảng (Cần làm / Đang làm / Hoàn thành / Tạm dừng)</option>
        {EXITED_STATUSES.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
