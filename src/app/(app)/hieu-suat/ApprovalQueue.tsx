"use client";

import { useState } from "react";
import { usePendingApprovals } from "@/hooks/queries/usePendingApprovals";
import { useApproveActual, useRejectActual } from "@/hooks/mutations/useApproveActual";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";
import { ApproveRejectActions } from "@/components/ApproveRejectActions";

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

  if (isLoading) return <p className="text-text-muted">Đang tải...</p>;
  if (!pending || pending.length === 0) {
    return <p className="text-text-faint">Không có kết quả nào đang chờ duyệt.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red">{error}</p>}
      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2">
              <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                Chỉ số
              </th>
              <th className="border-b border-border px-4 py-[9px] text-right text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                Kết quả
              </th>
              <th className="border-b border-border px-4 py-[9px] text-right text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {pending.map((entry, i) => (
              <tr key={entry.id} className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}>
                <td className="border-b border-border px-4 py-2.5 font-semibold text-text">
                  {METRIC_LABEL[entry.metricKey]}
                </td>
                <td className="border-b border-border px-4 py-2.5 text-right font-semibold text-text [font-variant-numeric:tabular-nums]">
                  {entry.actual.toLocaleString("vi-VN")}
                </td>
                <td className="border-b border-border px-4 py-2.5">
                  <ApproveRejectActions
                    decidedBadge={null}
                    isPending={approve.isPending || reject.isPending}
                    onApprove={() => handleApprove(entry.id)}
                    onReject={() => handleReject(entry.id)}
                    size="row"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
