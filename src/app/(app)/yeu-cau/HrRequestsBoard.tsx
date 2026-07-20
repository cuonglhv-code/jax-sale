"use client";

import { useState } from "react";
import type { RequestType } from "@/lib/data/types";
import { HR_FORM_REGISTRY } from "@/lib/domain/hr-forms";
import { RequestTypePicker } from "./RequestTypePicker";
import { AnnualLeaveForm } from "./AnnualLeaveForm";
import { LeaveFamilyForm } from "./LeaveFamilyForm";
import { OvertimeForm } from "./OvertimeForm";
import { SalaryAdvanceForm } from "./SalaryAdvanceForm";
import { PurchaseForm } from "./PurchaseForm";
import { BusinessTravelForm } from "./BusinessTravelForm";
import { MyRequestsList } from "./MyRequestsList";
import { MyCoverNominations } from "./MyCoverNominations";

interface HrRequestsBoardProps {
  remainingDays: number | null;
}

/**
 * US1 (T022) + US5 (T049): form-type picker + the schema-driven form for the selected type + "my
 * requests" — one page, one engine (FR-002). `shift_swap` uses its own dedicated cover-nomination
 * UI (US4) not shown here; render it once that surface exists — for now the picker marks it
 * registered but this board has no dedicated shift_swap form (out of this task's scope).
 */
export function HrRequestsBoard({ remainingDays }: HrRequestsBoardProps) {
  const [selectedType, setSelectedType] = useState<RequestType>("annual_leave");
  const isRegistered = Boolean(HR_FORM_REGISTRY[selectedType]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Yêu cầu nhân sự</h1>

      <MyCoverNominations />

      <RequestTypePicker selected={selectedType} onSelect={setSelectedType} />

      {selectedType === "annual_leave" && <AnnualLeaveForm remainingDays={remainingDays} />}
      {(selectedType === "sick_leave" || selectedType === "personal_leave" || selectedType === "unpaid_leave") && (
        <LeaveFamilyForm requestType={selectedType} />
      )}
      {selectedType === "overtime" && <OvertimeForm />}
      {selectedType === "salary_advance" && <SalaryAdvanceForm />}
      {selectedType === "purchase" && <PurchaseForm />}
      {selectedType === "business_travel" && <BusinessTravelForm />}
      {!isRegistered && <p className="text-sm text-gray-500">Loại yêu cầu này sẽ sớm ra mắt.</p>}

      <MyRequestsList />
    </div>
  );
}
