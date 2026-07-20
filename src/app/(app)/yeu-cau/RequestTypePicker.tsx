"use client";

import { REQUEST_TYPES, type RequestType } from "@/lib/data/types";
import { REQUEST_TYPE_LABEL } from "@/lib/domain/vocabulary";
import { HR_FORM_REGISTRY } from "@/lib/domain/hr-forms";

interface RequestTypePickerProps {
  selected: RequestType;
  onSelect: (type: RequestType) => void;
}

/** US1/US5 (T022/T047): one button per form type; only registered types are selectable (FR-002). */
export function RequestTypePicker({ selected, onSelect }: RequestTypePickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {REQUEST_TYPES.map((type) => {
        const isRegistered = Boolean(HR_FORM_REGISTRY[type]);
        const isSelected = type === selected;
        return (
          <button
            key={type}
            type="button"
            disabled={!isRegistered}
            onClick={() => onSelect(type)}
            className={`rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
              isSelected ? "border-blue-600 bg-blue-50" : ""
            }`}
          >
            {REQUEST_TYPE_LABEL[type]}
            {!isRegistered && <span className="ml-1 text-xs text-gray-400">(sắp ra mắt)</span>}
          </button>
        );
      })}
    </div>
  );
}
