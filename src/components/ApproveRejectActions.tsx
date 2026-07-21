import type { ReactNode } from "react";

interface ApproveRejectActionsProps {
  /** null = still pending a decision. Present = decided; the pair is replaced by `decidedBadge`. */
  decidedBadge: ReactNode | null;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  /** Labels default to "Duyệt"/"Từ chối" (the HR/KPI approve-reject wording) — MyCoverNominations
   *  overrides approveLabel to "Nhận dạy thay" (accept-a-cover wording), same visual pair. */
  approveLabel?: string;
  rejectLabel?: string;
  /** Row-inline (KPI/HR-Approvals tables, 30px) vs card-footer (HR Approvals cards, cover-nomination
   *  cards, 38px) — matches the two heights used in design_handoff_jax_sales_phase2. */
  size?: "row" | "card";
}

/**
 * Phase 2 (design_handoff_jax_sales_phase2, "New component spec: approve/reject action pair"): the
 * one new interaction this phase introduces, built once and reused everywhere a decision is made —
 * KPI's ApprovalQueue, HR Approvals' ApprovalQueueBoard, and MyCoverNominations' accept/decline.
 * Presentational only: each caller owns its own mutation hook (useApproveActual/useRejectActual,
 * useDecideRequest, useRespondCover — three genuinely different signatures) and passes plain
 * callbacks + the already-decided badge to render in the pair's place.
 *
 * Tokens only, nothing new: Duyệt = --btn-primary (navy fill); Từ chối = ghost using the
 * --st-rejected triple (text/border, --st-rejected-bg on hover) — ties to the SAME status the
 * request/actual lands in once rejected, not an arbitrary red.
 */
export function ApproveRejectActions({
  decidedBadge,
  onApprove,
  onReject,
  isPending,
  approveLabel = "Duyệt",
  rejectLabel = "Từ chối",
  size = "row",
}: ApproveRejectActionsProps) {
  if (decidedBadge !== null) {
    return <>{decidedBadge}</>;
  }

  const heightClass = size === "card" ? "h-[38px] px-4 text-[13px]" : "h-[30px] px-[13px] text-xs";

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onReject}
        disabled={isPending}
        className={`inline-flex items-center gap-[5px] rounded-lg border border-st-rejected-border bg-surface font-semibold text-st-rejected-text transition-colors hover:bg-st-rejected-bg disabled:cursor-default disabled:opacity-50 ${heightClass}`}
      >
        {rejectLabel}
      </button>
      <button
        type="button"
        onClick={onApprove}
        disabled={isPending}
        className={`inline-flex items-center gap-[5px] rounded-lg bg-navy font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-50 ${heightClass}`}
      >
        {approveLabel}
      </button>
    </div>
  );
}
