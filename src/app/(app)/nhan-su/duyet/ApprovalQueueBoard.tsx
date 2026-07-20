"use client";

import { useState } from "react";
import { useApprovalQueue } from "@/hooks/queries/hr/useApprovalQueue";
import { useDecideRequest } from "@/hooks/mutations/hr/useDecideRequest";
import { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, LEAVE_DAY_PART_LABEL } from "@/lib/domain/vocabulary";
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
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

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
    <div className="flex flex-col gap-2">
      {isLoading && <p>Đang tải...</p>}
      {error && <p className="text-red-600">{error.message}</p>}
      {decide.error && <p className="text-red-600">{decide.error.message}</p>}
      {data && data.length === 0 && <p className="text-gray-500">Không có yêu cầu nào đang chờ duyệt.</p>}
      {data?.map((request) => (
        <ApprovalRow
          key={request.id}
          request={request}
          isRejecting={rejectingId === request.id}
          reason={reason}
          isPending={decide.isPending}
          onApprove={() => approve(request.id)}
          onStartReject={() => startReject(request.id)}
          onCancelReject={cancelReject}
          onReasonChange={setReason}
          onSubmitReject={() => submitReject(request.id)}
        />
      ))}
    </div>
  );
}

interface ApprovalRowProps {
  request: HrRequest;
  isRejecting: boolean;
  reason: string;
  isPending: boolean;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onReasonChange: (value: string) => void;
  onSubmitReject: () => void;
}

function ApprovalRow({
  request,
  isRejecting,
  reason,
  isPending,
  onApprove,
  onStartReject,
  onCancelReject,
  onReasonChange,
  onSubmitReject,
}: ApprovalRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{REQUEST_TYPE_LABEL[request.requestType]}</span>
        <span>{" — "}</span>
        <span>{REQUEST_STATUS_LABEL[request.status]}</span>
        {request.startDate && (
          <span>
            {" · "}
            {request.startDate}
            {request.endDate && request.endDate !== request.startDate ? ` → ${request.endDate}` : ""}
            {request.dayPart && request.dayPart !== "full" ? ` (${LEAVE_DAY_PART_LABEL[request.dayPart]})` : ""}
          </span>
        )}
        {request.workingDays !== null && <span>{` · ${request.workingDays} ngày công`}</span>}
      </div>

      {!isRejecting && (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
            disabled={isPending}
            onClick={onApprove}
          >
            Duyệt
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
            disabled={isPending}
            onClick={onStartReject}
          >
            Từ chối
          </button>
        </div>
      )}

      {isRejecting && (
        <div className="flex flex-col gap-2">
          <textarea
            className="rounded border p-2"
            placeholder="Vui lòng nhập lý do từ chối"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
              disabled={isPending || !reason.trim()}
              onClick={onSubmitReject}
            >
              Xác nhận từ chối
            </button>
            <button type="button" className="rounded border px-3 py-1" onClick={onCancelReject}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
