"use client";

import { useState } from "react";
import type { RequestType } from "@/lib/data/types";
import { HR_FORM_REGISTRY } from "@/lib/domain/hr-forms";
import { RequestTypePicker } from "./RequestTypePicker";
import { AnnualLeaveForm } from "./AnnualLeaveForm";
import { MyRequestsList } from "./MyRequestsList";

interface HrRequestsBoardProps {
  remainingDays: number | null;
}

/** US1 (T022): form-type picker + the annual-leave form + "my requests" — one page, one engine. */
export function HrRequestsBoard({ remainingDays }: HrRequestsBoardProps) {
  const [selectedType, setSelectedType] = useState<RequestType>("annual_leave");
  const isRegistered = Boolean(HR_FORM_REGISTRY[selectedType]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Yêu cầu nhân sự</h1>

      <RequestTypePicker selected={selectedType} onSelect={setSelectedType} />

      {selectedType === "annual_leave" && <AnnualLeaveForm remainingDays={remainingDays} />}
      {!isRegistered && <p className="text-sm text-gray-500">Loại yêu cầu này sẽ sớm ra mắt.</p>}

      <MyRequestsList />
    </div>
  );
}
