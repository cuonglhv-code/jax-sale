"use client";

import { useMyRequests } from "@/hooks/queries/hr/useMyRequests";
import { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, LEAVE_DAY_PART_LABEL } from "@/lib/domain/vocabulary";

/** US1: "my requests" — a submitted request appears here (acceptance criterion). */
export function MyRequestsList() {
  const { data, isLoading, error } = useMyRequests();

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Yêu cầu của tôi</h2>
      {isLoading && <p>Đang tải...</p>}
      {error && <p className="text-red-600">{error.message}</p>}
      {data && data.length === 0 && <p className="text-gray-500">Chưa có yêu cầu nào.</p>}
      {data?.map((r) => (
        <div key={r.id} className="rounded border p-2 text-sm">
          <span className="font-medium">{REQUEST_TYPE_LABEL[r.requestType]}</span>
          {" — "}
          <span>{REQUEST_STATUS_LABEL[r.status]}</span>
          {r.startDate && (
            <span>
              {" · "}
              {r.startDate}
              {r.endDate && r.endDate !== r.startDate ? ` → ${r.endDate}` : ""}
              {r.dayPart && r.dayPart !== "full" ? ` (${LEAVE_DAY_PART_LABEL[r.dayPart]})` : ""}
            </span>
          )}
          {r.workingDays !== null && <span>{` · ${r.workingDays} ngày công`}</span>}
        </div>
      ))}
    </div>
  );
}
