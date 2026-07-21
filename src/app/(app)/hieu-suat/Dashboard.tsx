"use client";

import { useSearchParams } from "next/navigation";
import { useDashboard } from "@/hooks/queries/useDashboard";
import { METRIC_LABEL, ATTAINMENT_STATE_LABEL, ATTAINMENT_COLOR, ALL_CENTRES } from "@/lib/domain/vocabulary";

/**
 * US3 (manager/admin tier, AC-3.2/3.3/3.5/3.6): attainment by consultant at the caller's tier
 * (centre for managers/admins, network for super_admin). Vocabulary-backed states; never a raw 0%
 * for a not_set target. Centre narrowing (super_admin only — the shell's CentreSwitcher writes
 * `?centre=`) is applied server-side; the RPC ignores the param for non-network-wide callers.
 */
export function Dashboard({ period }: { period: string }) {
  const searchParams = useSearchParams();
  const centreParam = searchParams.get("centre");
  const centreId = centreParam && centreParam !== ALL_CENTRES ? centreParam : undefined;
  const { data, isLoading } = useDashboard(period, 1, centreId);

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Bảng hiệu suất</h2>
      </div>
      {isLoading && <p className="px-4 py-4 text-text-muted">Đang tải...</p>}
      {!isLoading && (!data || data.rows.length === 0) && (
        <p className="px-4 py-4 text-text-faint">Chưa có dữ liệu cho kỳ này.</p>
      )}
      {!isLoading && data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Tư vấn viên
                </th>
                <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Chỉ số
                </th>
                <th className="border-b border-border px-4 py-[9px] text-right text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Kết quả (đã duyệt)
                </th>
                <th className="border-b border-border px-4 py-[9px] text-right text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Mục tiêu
                </th>
                <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                  Mức đạt
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIndex) =>
                row.attainments.map((attainment, i) => {
                  const color = ATTAINMENT_COLOR[attainment.state];
                  const isZebra = (rowIndex + i) % 2 === 1;
                  return (
                    <tr
                      key={`${row.scopeId}-${attainment.metricKey}`}
                      className={`transition-colors hover:bg-surface-2 ${isZebra ? "bg-surface-2" : ""}`}
                    >
                      <td className="border-b border-border px-4 py-2.5 font-semibold text-text">{row.scopeName}</td>
                      <td className="border-b border-border px-4 py-2.5 text-text-muted">
                        {METRIC_LABEL[attainment.metricKey]}
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right text-text [font-variant-numeric:tabular-nums]">
                        {attainment.approvedActual.toLocaleString("vi-VN")}
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right text-text-muted [font-variant-numeric:tabular-nums]">
                        {attainment.target === null ? "—" : attainment.target.toLocaleString("vi-VN")}
                      </td>
                      <td className="border-b border-border px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
                          style={{ color: color.text, background: color.bg, borderColor: color.border }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                          {ATTAINMENT_STATE_LABEL[attainment.state]}
                          {attainment.ratio !== null && ` (${Math.round(attainment.ratio * 100)}%)`}
                        </span>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
