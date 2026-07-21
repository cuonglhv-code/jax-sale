"use client";

import { useMyPerformance } from "@/hooks/queries/useMyPerformance";
import { classifyAttainment } from "@/services/kpi/attainment";
import { METRIC_LABEL, APPROVAL_STATE_LABEL, ATTAINMENT_STATE_LABEL, ATTAINMENT_COLOR } from "@/lib/domain/vocabulary";

/**
 * US1/US3 (consultant tier, AC-3.1): a consultant sees ONLY their own actual-vs-target, including
 * pending/rejected values marked with their approval state. No peer leaderboard (AC-4.3). Card +
 * per-metric progress bar matches design_handoff_jax_sales_phase2's "Kết quả của tôi" panel.
 */
export function MyPerformance({ period }: { period: string }) {
  const { data: entries, isLoading } = useMyPerformance(period);

  if (isLoading) return <p className="text-text-muted">Đang tải...</p>;

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Kết quả của tôi</h2>
      </div>
      {!entries || entries.length === 0 ? (
        <p className="px-4 py-4 text-text-faint">Chưa có kết quả nào cho kỳ này.</p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {entries.map((entry) => {
            // Only APPROVED counts toward attainment; pending/rejected still shown with their state.
            const approvedActual = entry.approvalStatus === "approved" ? entry.actual : 0;
            const attainment = classifyAttainment(entry.metricKey, approvedActual, entry.target);
            const color = ATTAINMENT_COLOR[attainment.state];
            const barWidth = attainment.ratio === null ? "0%" : `${Math.min(100, Math.round(attainment.ratio * 100))}%`;
            return (
              <div key={entry.id}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text">{METRIC_LABEL[entry.metricKey]}</span>
                  <span
                    className="ml-auto inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
                    style={{ color: color.text, background: color.bg, borderColor: color.border }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                    {ATTAINMENT_STATE_LABEL[attainment.state]}
                    {attainment.ratio !== null && ` (${Math.round(attainment.ratio * 100)}%)`}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-text [font-variant-numeric:tabular-nums]">
                    {entry.actual.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-[12.5px] text-text-muted">
                    / {entry.target === null ? "—" : entry.target.toLocaleString("vi-VN")} ·{" "}
                    {APPROVAL_STATE_LABEL[entry.approvalStatus]}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-navy" style={{ width: barWidth }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
