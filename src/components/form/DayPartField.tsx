import { LEAVE_DAY_PARTS, type LeaveDayPart } from "@/lib/data/types";
import { LEAVE_DAY_PART_LABEL } from "@/lib/domain/vocabulary";

interface DayPartFieldProps {
  value: LeaveDayPart;
  onChange: (value: LeaveDayPart) => void;
}

/** Segmented Cả ngày/Buổi sáng/Buổi chiều control (design_handoff_jax_sales_phase2), matching the
 *  Tasks priority-picker segmented pattern. Shared by AnnualLeaveForm and LeaveFamilyForm — both
 *  bind the same LeaveDayPart field. */
export function DayPartField({ value, onChange }: DayPartFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">Buổi nghỉ</span>
      <div className="inline-flex max-w-[360px] gap-[3px] rounded-[var(--radius-field)] border border-border bg-surface-3 p-[3px]">
        {LEAVE_DAY_PARTS.map((part) => {
          const isActive = value === part;
          return (
            <button
              key={part}
              type="button"
              onClick={() => onChange(part)}
              className={`h-8 flex-1 rounded-md text-[12.5px] font-semibold transition-all ${
                isActive ? "bg-surface text-navy shadow-[inset_0_0_0_1px_var(--color-navy)]" : "text-text-muted"
              }`}
            >
              {LEAVE_DAY_PART_LABEL[part]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
