export type TaskBoardView = "table" | "daily";

const TABS: { key: TaskBoardView; label: string }[] = [
  { key: "table", label: "Bảng" },
  { key: "daily", label: "Theo người" },
];

/** View switcher for the Tasks page — replaces the old Kanban board with Table/Daily Work views. */
export function TaskViewTabs({
  active,
  onChange,
}: {
  active: TaskBoardView;
  onChange: (view: TaskBoardView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`h-[30px] rounded-md px-3 text-[12.5px] font-semibold transition-colors ${
              isActive ? "bg-surface text-navy shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
