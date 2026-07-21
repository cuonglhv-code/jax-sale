"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLeaderboard } from "@/hooks/queries/useLeaderboard";
import { METRIC_KEYS } from "@/lib/data/types";
import { METRIC_LABEL, ALL_CENTRES } from "@/lib/domain/vocabulary";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts.at(-2)?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

/** US4 (AC-4.1/4.2/4.4): tier-scoped ranked leaderboard — manager/admin/super_admin only. Centre
 *  narrowing (super_admin only) follows the shell's `?centre=` param, same as Dashboard.tsx. Ranked
 *  rows with an avatar + navy progress bar match design_handoff_jax_sales_phase2's leaderboard panel
 *  — the bar's width is relative to the top-ranked consultant's result (no separate "max" value in
 *  the payload, so this normalizes within the returned page rather than against a global target). */
export function Leaderboard({ period }: { period: string }) {
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>(METRIC_KEYS[0]);
  const searchParams = useSearchParams();
  const centreParam = searchParams.get("centre");
  const centreId = centreParam && centreParam !== ALL_CENTRES ? centreParam : undefined;
  const { data, isLoading } = useLeaderboard(period, metricKey, centreId);

  const topActual = data?.rows[0]?.approvedActual ?? 0;

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Bảng xếp hạng tư vấn</h2>
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value as (typeof METRIC_KEYS)[number])}
          className="ml-auto h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-medium text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
        >
          {METRIC_KEYS.map((k) => (
            <option key={k} value={k}>
              {METRIC_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      {isLoading && <p className="px-4 py-4 text-text-muted">Đang tải...</p>}
      {!isLoading && (!data || data.rows.length === 0) && (
        <p className="px-4 py-4 text-text-faint">Chưa có dữ liệu xếp hạng cho kỳ này.</p>
      )}
      {!isLoading && data && data.rows.length > 0 && (
        <div>
          {data.rows.map((row) => {
            const barWidth = topActual > 0 ? `${Math.round((row.approvedActual / topActual) * 100)}%` : "0%";
            const isTop3 = row.rank <= 3;
            return (
              <div
                key={row.consultantId}
                className="flex items-center gap-3 border-b border-border px-4 py-[11px] transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <span
                  className={`w-5 shrink-0 text-center text-[13px] font-bold [font-variant-numeric:tabular-nums] ${
                    isTop3 ? "text-navy" : "text-text-faint"
                  }`}
                >
                  {row.rank}
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[11px] font-bold text-navy">
                  {initials(row.consultantName)}
                </span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-text">
                  {row.consultantName}
                </span>
                <div className="h-[7px] w-24 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-navy" style={{ width: barWidth }} />
                </div>
                <span className="w-24 shrink-0 text-right text-[13px] font-bold text-text [font-variant-numeric:tabular-nums]">
                  {row.approvedActual.toLocaleString("vi-VN")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
