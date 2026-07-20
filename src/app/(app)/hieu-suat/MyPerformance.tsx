"use client";

import { useMyPerformance } from "@/hooks/queries/useMyPerformance";
import { classifyAttainment } from "@/services/kpi/attainment";
import { METRIC_LABEL, APPROVAL_STATE_LABEL, ATTAINMENT_STATE_LABEL, ATTAINMENT_COLOR } from "@/lib/domain/vocabulary";

/**
 * US1/US3 (consultant tier, AC-3.1): a consultant sees ONLY their own actual-vs-target, including
 * pending/rejected values marked with their approval state. No peer leaderboard (AC-4.3).
 */
export function MyPerformance({ period }: { period: string }) {
  const { data: entries, isLoading } = useMyPerformance(period);

  if (isLoading) return <p className="text-sm text-gray-500">Đang tải...</p>;
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có kết quả nào cho kỳ này.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">Chỉ số</th>
          <th className="py-2">Kết quả</th>
          <th className="py-2">Mục tiêu</th>
          <th className="py-2">Trạng thái duyệt</th>
          <th className="py-2">Mức đạt</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          // Only APPROVED counts toward attainment; pending/rejected still shown with their state.
          const approvedActual = entry.approvalStatus === "approved" ? entry.actual : 0;
          const attainment = classifyAttainment(entry.metricKey, approvedActual, entry.target);
          const color = ATTAINMENT_COLOR[attainment.state];
          return (
            <tr key={entry.id} className="border-b">
              <td className="py-2">{METRIC_LABEL[entry.metricKey]}</td>
              <td className="py-2">{entry.actual.toLocaleString("vi-VN")}</td>
              <td className="py-2">{entry.target === null ? "—" : entry.target.toLocaleString("vi-VN")}</td>
              <td className="py-2">{APPROVAL_STATE_LABEL[entry.approvalStatus]}</td>
              <td className="py-2">
                <span
                  className="rounded px-2 py-0.5"
                  style={{ color: color.text, backgroundColor: color.bg, border: `1px solid ${color.border}` }}
                >
                  {ATTAINMENT_STATE_LABEL[attainment.state]}
                  {attainment.ratio !== null && ` (${Math.round(attainment.ratio * 100)}%)`}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
