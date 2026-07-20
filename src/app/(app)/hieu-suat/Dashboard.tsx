"use client";

import { useDashboard } from "@/hooks/queries/useDashboard";
import { METRIC_LABEL, ATTAINMENT_STATE_LABEL, ATTAINMENT_COLOR } from "@/lib/domain/vocabulary";

/**
 * US3 (manager/admin tier, AC-3.2/3.3/3.5/3.6): attainment by consultant at the caller's tier
 * (centre for managers/admins, network for super_admin). Vocabulary-backed states; never a raw 0%
 * for a not_set target.
 */
export function Dashboard({ period }: { period: string }) {
  const { data, isLoading } = useDashboard(period);

  if (isLoading) return <p className="text-sm text-gray-500">Đang tải...</p>;
  if (!data || data.rows.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có dữ liệu cho kỳ này.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">Tư vấn viên</th>
          <th className="py-2">Chỉ số</th>
          <th className="py-2">Kết quả (đã duyệt)</th>
          <th className="py-2">Mục tiêu</th>
          <th className="py-2">Mức đạt</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) =>
          row.attainments.map((attainment) => {
            const color = ATTAINMENT_COLOR[attainment.state];
            return (
              <tr key={`${row.scopeId}-${attainment.metricKey}`} className="border-b">
                <td className="py-2">{row.scopeName}</td>
                <td className="py-2">{METRIC_LABEL[attainment.metricKey]}</td>
                <td className="py-2">{attainment.approvedActual.toLocaleString("vi-VN")}</td>
                <td className="py-2">{attainment.target === null ? "—" : attainment.target.toLocaleString("vi-VN")}</td>
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
          }),
        )}
      </tbody>
    </table>
  );
}
