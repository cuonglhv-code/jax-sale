"use client";

import { useMyCoverNominations } from "@/hooks/queries/hr/useMyCoverNominations";
import { useRespondCover } from "@/hooks/mutations/hr/useRespondCover";
import { ApproveRejectActions } from "@/components/ApproveRejectActions";

/** US4 (T043): a teacher's pending cover nominations — accept/decline inline, card layout matching
 *  HR Requests' other section panels (design_handoff_jax_sales_phase2). */
export function MyCoverNominations() {
  const { data, isLoading, error } = useMyCoverNominations();
  const respond = useRespondCover();

  if (isLoading) return null;
  if (error) return <p className="text-sm text-red">{error.message}</p>;
  if (!data || data.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Yêu cầu dạy thay</h2>
        <span className="text-xs font-medium text-text-faint">{data.length} chờ phản hồi</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {respond.error && <p className="text-sm text-red">{respond.error.message}</p>}
        {data.map((cover) => (
          <div key={cover.id} className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-border p-3">
            <p className="m-0 text-[13px] font-semibold leading-[1.35] text-text">Buổi học ngày {cover.sessionDate}</p>
            <ApproveRejectActions
              decidedBadge={null}
              isPending={respond.isPending}
              approveLabel="Nhận dạy thay"
              onApprove={() => respond.mutate({ coverId: cover.id, accept: true })}
              onReject={() => respond.mutate({ coverId: cover.id, accept: false })}
              size="card"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
