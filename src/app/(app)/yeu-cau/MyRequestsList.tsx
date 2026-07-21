"use client";

import { useMyRequests } from "@/hooks/queries/hr/useMyRequests";
import {
  REQUEST_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_COLOR,
  LEAVE_DAY_PART_LABEL,
} from "@/lib/domain/vocabulary";

function formatPeriod(r: { startDate: string | null; endDate: string | null; dayPart: string | null }): string {
  if (!r.startDate) return "—";
  const range = r.endDate && r.endDate !== r.startDate ? `${r.startDate} → ${r.endDate}` : r.startDate;
  const dayPartLabel = r.dayPart && r.dayPart !== "full" ? ` (${LEAVE_DAY_PART_LABEL[r.dayPart as "morning" | "afternoon"]})` : "";
  return `${range}${dayPartLabel}`;
}

/** US1: "my requests" — a submitted request appears here (acceptance criterion). Table with real
 *  status badges (design_handoff_jax_sales_phase2), matching the HR Reports table pattern. */
export function MyRequestsList() {
  const { data, isLoading, error } = useMyRequests();

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Yêu cầu của tôi</h2>
        {data && <span className="text-xs font-medium text-text-faint">{data.length} yêu cầu</span>}
      </div>
      {isLoading && <p className="px-4 py-4 text-text-muted">Đang tải...</p>}
      {error && <p className="px-4 py-4 text-red">{error.message}</p>}
      {data && data.length === 0 && <p className="px-4 py-4 text-text-faint">Chưa có yêu cầu nào.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Loại
                </th>
                <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Thời gian
                </th>
                <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const color = REQUEST_STATUS_COLOR[r.status];
                return (
                  <tr key={r.id} className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}>
                    <td className="border-b border-border px-4 py-2.5 font-semibold text-text">
                      {REQUEST_TYPE_LABEL[r.requestType]}
                    </td>
                    <td className="border-b border-border px-4 py-2.5 text-text-muted [font-variant-numeric:tabular-nums]">
                      {formatPeriod(r)}
                      {r.workingDays !== null && ` · ${r.workingDays} ngày công`}
                    </td>
                    <td className="border-b border-border px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
                        style={{ color: color.text, background: color.bg, borderColor: color.border }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                        {REQUEST_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
