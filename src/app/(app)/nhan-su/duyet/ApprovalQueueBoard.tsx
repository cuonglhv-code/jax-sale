"use client";

import { useState } from "react";
import { useApprovalQueue } from "@/hooks/queries/hr/useApprovalQueue";
import { useDecideRequest } from "@/hooks/mutations/hr/useDecideRequest";
import { useAttachmentUrl } from "@/hooks/mutations/hr/useAttachmentUrl";
import {
  REQUEST_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_COLOR,
  LEAVE_DAY_PART_LABEL,
} from "@/lib/domain/vocabulary";
import { ApproveRejectActions } from "@/components/ApproveRejectActions";
import type { HrRequest } from "@/lib/data/types";

/**
 * US2 (T036): one row per request awaiting a decision (who/what/when/working_days/status), an
 * Approve button, and a Reject button that opens an inline reason prompt (plain local state, no
 * dialog library — matches the rest of this slice's minimal-UI style) requiring non-empty text
 * before submit.
 */
export function ApprovalQueueBoard() {
  const { data, isLoading, error } = useApprovalQueue();
  const decide = useDecideRequest();
  const attachmentUrl = useAttachmentUrl();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // US6 (T055): mint a signed URL and open it in a new tab — the server action re-checks
  // eligibility (approver-of-centre or super_admin, both of which this page is already gated to),
  // so this button is not itself the security boundary, only a convenience affordance.
  function viewAttachment(requestId: string) {
    attachmentUrl.mutate(requestId, {
      onSuccess: (url) => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
    });
  }

  function startReject(requestId: string) {
    setRejectingId(requestId);
    setReason("");
  }

  function cancelReject() {
    setRejectingId(null);
    setReason("");
  }

  function submitReject(requestId: string) {
    if (!reason.trim()) return;
    decide.mutate(
      { requestId, decision: "reject", reason },
      {
        onSuccess: () => {
          setRejectingId(null);
          setReason("");
        },
      },
    );
  }

  function approve(requestId: string) {
    decide.mutate({ requestId, decision: "approve" });
  }

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-[18px] px-6 py-5 pb-8">
      {data && (
        <p className="m-0 text-[13px] font-semibold text-text-muted">{data.length} yêu cầu đang chờ duyệt</p>
      )}
      {isLoading && <p className="text-text-muted">Đang tải...</p>}
      {error && <p className="text-red">{error.message}</p>}
      {decide.error && <p className="text-red">{decide.error.message}</p>}
      {data && data.length === 0 && <p className="text-text-faint">Không có yêu cầu nào đang chờ duyệt.</p>}
      <div className="flex flex-col gap-3.5">
      {data?.map((request) => (
        <ApprovalRow
          key={request.id}
          request={request}
          isRejecting={rejectingId === request.id}
          reason={reason}
          isPending={decide.isPending}
          isLoadingAttachment={attachmentUrl.isPending}
          onApprove={() => approve(request.id)}
          onStartReject={() => startReject(request.id)}
          onCancelReject={cancelReject}
          onReasonChange={setReason}
          onSubmitReject={() => submitReject(request.id)}
          onViewAttachment={() => viewAttachment(request.id)}
        />
      ))}
      </div>
    </div>
  );
}

interface ApprovalRowProps {
  request: HrRequest;
  isRejecting: boolean;
  reason: string;
  isPending: boolean;
  isLoadingAttachment: boolean;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onReasonChange: (value: string) => void;
  onSubmitReject: () => void;
  onViewAttachment: () => void;
}

function ApprovalRow({
  request,
  isRejecting,
  reason,
  isPending,
  isLoadingAttachment,
  onApprove,
  onStartReject,
  onCancelReject,
  onReasonChange,
  onSubmitReject,
  onViewAttachment,
}: ApprovalRowProps) {
  const statusColor = REQUEST_STATUS_COLOR[request.status];
  const period =
    request.startDate &&
    `${request.startDate}${request.endDate && request.endDate !== request.startDate ? ` → ${request.endDate}` : ""}${
      request.dayPart && request.dayPart !== "full" ? ` (${LEAVE_DAY_PART_LABEL[request.dayPart]})` : ""
    }`;

  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
        <span className="rounded-lg border border-border bg-surface-3 px-2.5 py-1 text-xs font-semibold text-text">
          {REQUEST_TYPE_LABEL[request.requestType]}
        </span>
        <span
          className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
          style={{ color: statusColor.text, background: statusColor.bg, borderColor: statusColor.border }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
          {REQUEST_STATUS_LABEL[request.status]}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {period && (
            <div>
              <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[.03em] text-text-faint">Thời gian</div>
              <div className="text-[13px] text-text [font-variant-numeric:tabular-nums]">{period}</div>
            </div>
          )}
          {(request.workingDays !== null || request.amount !== null) && (
            <div>
              <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[.03em] text-text-faint">Số lượng</div>
              <div className="text-[13px] text-text">
                {request.workingDays !== null && `${request.workingDays} ngày công`}
                {request.amount !== null && request.amount.toLocaleString("vi-VN")}
              </div>
            </div>
          )}
        </div>

        {(request.status === "awaiting_cover" || request.needsReresolution) && (
          <div className="flex items-center gap-2 rounded-lg border border-st-awaiting-border bg-st-awaiting-bg px-2.5 py-2 text-[12.5px] font-medium text-st-awaiting-text">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
            {request.needsReresolution
              ? "Người dạy thay đã được giải phóng, cần đề cử lại"
              : "Đang chờ giáo viên dạy thay xác nhận"}
          </div>
        )}

        {/* US6 (T055): never in the row body itself — a small indicator + an on-demand signed-URL
            button only, never the document content or storage path (data-model §7). */}
        {request.hasAttachment && (
          <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
            <span>📎 Có tài liệu đính kèm</span>
            <button
              type="button"
              className="rounded-lg border border-border px-2 py-1 text-navy transition-colors hover:bg-surface-3 disabled:opacity-50"
              disabled={isLoadingAttachment}
              onClick={onViewAttachment}
            >
              {isLoadingAttachment ? "Đang tải..." : "Xem tài liệu"}
            </button>
          </div>
        )}

        {!isRejecting && (
          <ApproveRejectActions
            decidedBadge={null}
            isPending={isPending}
            onApprove={onApprove}
            onReject={onStartReject}
            size="card"
          />
        )}

        {isRejecting && (
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              placeholder="Lý do (nếu từ chối)…"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="h-[38px] min-w-[180px] flex-1 rounded-[var(--radius-field)] border border-border bg-surface-2 px-3 text-[13px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
            />
            <button
              type="button"
              onClick={onCancelReject}
              className="h-[38px] rounded-[var(--radius-field)] border border-border bg-surface-2 px-4 text-[13px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-3"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isPending || !reason.trim()}
              onClick={onSubmitReject}
              className="h-[38px] rounded-[var(--radius-field)] border border-st-rejected-border bg-surface px-4 text-[13px] font-semibold text-st-rejected-text transition-colors hover:bg-st-rejected-bg disabled:cursor-default disabled:opacity-50"
            >
              Xác nhận từ chối
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
