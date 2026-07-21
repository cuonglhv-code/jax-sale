"use client";

import { useState } from "react";
import type { RequestType } from "@/lib/data/types";
import { HR_FORM_REGISTRY } from "@/lib/domain/hr-forms";
import { REQUEST_TYPE_LABEL } from "@/lib/domain/vocabulary";
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
 * registered but this board has no dedicated shift_swap form (out of this task's scope). Layout
 * matches design_handoff_jax_sales_phase2: one "Tạo yêu cầu mới" card (picker + selected form), then
 * a 2-column grid with the requester's own lists below it.
 */
export function HrRequestsBoard({ remainingDays }: HrRequestsBoardProps) {
  const [selectedType, setSelectedType] = useState<RequestType>("annual_leave");
  const isRegistered = Boolean(HR_FORM_REGISTRY[selectedType]);

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-5 px-6 py-5 pb-8">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <span className="h-4 w-[3px] rounded-sm bg-red" />
          <h2 className="m-0 text-[14.5px] font-bold text-text">Tạo yêu cầu mới</h2>
        </div>
        <div className="flex flex-col gap-[18px] p-4">
          <RequestTypePicker selected={selectedType} onSelect={setSelectedType} />

          <div className="h-px bg-border" />

          <h3 className="m-0 text-[13.5px] font-bold text-text">{REQUEST_TYPE_LABEL[selectedType]}</h3>

          {selectedType === "annual_leave" && <AnnualLeaveForm remainingDays={remainingDays} />}
          {(selectedType === "sick_leave" || selectedType === "personal_leave" || selectedType === "unpaid_leave") && (
            <LeaveFamilyForm requestType={selectedType} />
          )}
          {selectedType === "overtime" && <OvertimeForm />}
          {selectedType === "salary_advance" && <SalaryAdvanceForm />}
          {selectedType === "purchase" && <PurchaseForm />}
          {selectedType === "business_travel" && <BusinessTravelForm />}
          {!isRegistered && <p className="text-[13px] text-text-faint">Loại yêu cầu này sẽ sớm ra mắt.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <MyRequestsList />
        <MyCoverNominations />
      </div>
    </div>
  );
}
