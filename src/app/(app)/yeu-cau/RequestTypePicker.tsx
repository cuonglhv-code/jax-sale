"use client";

import type { RequestType } from "@/lib/data/types";
import { REQUEST_TYPE_LABEL } from "@/lib/domain/vocabulary";
import { HR_FORM_REGISTRY } from "@/lib/domain/hr-forms";

interface RequestTypePickerProps {
  selected: RequestType;
  onSelect: (type: RequestType) => void;
}

/** design_handoff_jax_sales_phase2: the 9 request types grouped by natural category — purely a
 *  display grouping (REQUEST_TYPES itself is unchanged, this doesn't reorder or filter it). */
const TYPE_GROUPS: { title: string; types: RequestType[] }[] = [
  { title: "Nghỉ phép", types: ["annual_leave", "sick_leave", "personal_leave", "unpaid_leave"] },
  { title: "Tạm ứng & mua sắm", types: ["salary_advance", "purchase"] },
  { title: "Vận hành lịch dạy", types: ["shift_swap", "overtime", "business_travel"] },
];

/** US1/US5 (T022/T047): one button per form type, grouped into 3 labeled clusters; only registered
 *  types are selectable (FR-002). */
export function RequestTypePicker({ selected, onSelect }: RequestTypePickerProps) {
  return (
    <div className="flex flex-col gap-[18px]">
      {TYPE_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[.06em] text-text-faint">{group.title}</div>
          <div className="flex flex-wrap gap-2">
            {group.types.map((type) => {
              const isRegistered = Boolean(HR_FORM_REGISTRY[type]);
              const isSelected = type === selected;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!isRegistered}
                  onClick={() => onSelect(type)}
                  className={`rounded-[var(--radius-field)] border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? "border-navy bg-navy-tint text-navy"
                      : "border-border bg-surface-2 text-text hover:border-border-strong"
                  }`}
                >
                  {REQUEST_TYPE_LABEL[type]}
                  {!isRegistered && <span className="ml-1.5 text-[10.5px] text-text-faint">(sắp ra mắt)</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
