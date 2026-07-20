"use client";

import { useState } from "react";
import { usePendingApprovals } from "@/hooks/queries/usePendingApprovals";
import { useApproveActual, useRejectActual } from "@/hooks/mutations/useApproveActual";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";

/** US7: a centre manager/admin approves or rejects their centre's pending actuals (AC-7.1/7.2). */
export function ApprovalQueue({ period }: { period: string }) {
  const { data: pending, isLoading } = usePendingApprovals(period);
  const approve = useApproveActual();
  const reject = useRejectActual();
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(entryId: string) {
    setError(null);
    try {
      await approve.mutateAsync(entryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  async function handleReject(entryId: string) {
    setError(null);
    try {
      await reject.mutateAsync({ entryId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Đang tải...</p>;
  if (!pending || pending.length === 0) {
    return <p className="text-sm text-gray-500">Không có kết quả nào đang chờ duyệt.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Chỉ số</th>
            <th className="py-2">Kết quả</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {pending.map((entry) => (
            <tr key={entry.id} className="border-b">
              <td className="py-2">{METRIC_LABEL[entry.metricKey]}</td>
              <td className="py-2">{entry.actual.toLocaleString("vi-VN")}</td>
              <td className="flex gap-2 py-2">
                <button
                  type="button"
                  onClick={() => handleApprove(entry.id)}
                  disabled={approve.isPending || reject.isPending}
                  className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(entry.id)}
                  disabled={approve.isPending || reject.isPending}
                  className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
                >
                  Từ chối
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
