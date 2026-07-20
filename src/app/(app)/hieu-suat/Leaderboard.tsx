"use client";

import { useState } from "react";
import { useLeaderboard } from "@/hooks/queries/useLeaderboard";
import { METRIC_KEYS } from "@/lib/data/types";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";
import { SelectField } from "@/components/form";

/** US4 (AC-4.1/4.2/4.4): tier-scoped ranked leaderboard — manager/admin/super_admin only. */
export function Leaderboard({ period }: { period: string }) {
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>(METRIC_KEYS[0]);
  const { data, isLoading } = useLeaderboard(period, metricKey);

  return (
    <div className="flex flex-col gap-2">
      <SelectField
        label="Xếp hạng theo"
        value={metricKey}
        onChange={(v) => setMetricKey(v as (typeof METRIC_KEYS)[number])}
        options={METRIC_KEYS.map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
      />
      {isLoading && <p className="text-sm text-gray-500">Đang tải...</p>}
      {!isLoading && (!data || data.rows.length === 0) && (
        <p className="text-sm text-gray-500">Chưa có dữ liệu xếp hạng cho kỳ này.</p>
      )}
      {!isLoading && data && data.rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Hạng</th>
              <th className="py-2">Tư vấn viên</th>
              <th className="py-2">Kết quả (đã duyệt)</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.consultantId} className="border-b">
                <td className="py-2">{row.rank}</td>
                <td className="py-2">{row.consultantName}</td>
                <td className="py-2">{row.approvedActual.toLocaleString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
