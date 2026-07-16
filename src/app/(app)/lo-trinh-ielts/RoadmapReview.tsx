"use client";

import type { Roadmap } from "@/services/ielts/types";

/**
 * US5 (T033/T034): review the roadmap as the student will see it; add a consultant note; remove a
 * course (non-blocking "departs from standard ladder" warning + manualEdited flag). The internal
 * deadline warning is shown here to the CONSULTANT ONLY (amber) — it is never in the PDF (the PDF
 * takes StudentRoadmapView, which structurally omits it).
 */
export function RoadmapReview({
  roadmap,
  note,
  onNoteChange,
  onRemoveCourse,
  onApprove,
  submitting,
  message,
}: {
  roadmap: Roadmap;
  note: string;
  onNoteChange: (v: string) => void;
  onRemoveCourse: (index: number) => void;
  onApprove: () => void;
  submitting: boolean;
  message: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* CONSULTANT-ONLY deadline warning (amber). Never reaches the student PDF. */}
      {roadmap.internalWarning && (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ Cảnh báo (chỉ tư vấn viên): dự kiến hoàn thành {roadmap.internalWarning.projectedCompletion}{" "}
          muộn hơn ngày thi {roadmap.internalWarning.targetExamDate}. Đề xuất:{" "}
          {roadmap.internalWarning.recommend === "intensive" ? "chuyển cường độ Tăng cường" : "điều chỉnh mục tiêu"}.
        </div>
      )}
      {roadmap.consultantNoteInternal && (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ (chỉ tư vấn viên): {roadmap.consultantNoteInternal.message}
        </div>
      )}

      <div className="rounded border p-4">
        <p className="mb-2 font-semibold">
          Lộ trình: {roadmap.totalSessions} buổi ·{" "}
          {roadmap.totalMonths ? Math.round(roadmap.totalMonths) : "—"} tháng
        </p>
        <ul className="flex flex-col gap-1">
          {roadmap.courses.map((c, i) => (
            <li key={`${c.code}-${i}`} className="flex items-center justify-between text-sm">
              <span>
                {i + 1}. {c.name} — {c.sessions} buổi{c.sessionsProvisional ? " (dự kiến)" : ""}
              </span>
              <button onClick={() => onRemoveCourse(i)} className="text-xs text-red-600 hover:underline">
                Xóa
              </button>
            </li>
          ))}
        </ul>
        {roadmap.manualEdited && (
          <p className="mt-2 text-xs text-amber-700">
            ⚠ Lộ trình đã được chỉnh sửa thủ công — khác với lộ trình chuẩn.
          </p>
        )}
      </div>

      <label className="text-sm">
        Ghi chú từ tư vấn viên (hiển thị cho học viên)
        <textarea className="w-full rounded border px-2 py-1" value={note} onChange={(e) => onNoteChange(e.target.value)} />
      </label>

      <button
        onClick={onApprove}
        disabled={submitting}
        className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "Đang xử lý..." : "Duyệt & gửi cho học viên"}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
