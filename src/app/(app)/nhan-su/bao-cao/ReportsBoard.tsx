"use client";

import { useState } from "react";
import { unparse } from "papaparse";
import { useLeaveReport } from "@/hooks/queries/hr/useLeaveReport";
import { useRequestsSummary } from "@/hooks/queries/hr/useRequestsSummary";
import { useOutstandingBalances } from "@/hooks/queries/hr/useOutstandingBalances";
import { useCoverageView } from "@/hooks/queries/hr/useCoverageView";
import { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL } from "@/lib/domain/vocabulary";

const CURRENT_LEAVE_YEAR = new Date().getFullYear();

/** Trigger a client-side CSV download from already-fetched rows (US8, T062 — no server export endpoint exists yet). */
function downloadCsv(fileName: string, rows: readonly Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const csv = unparse([...rows]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * US8 (T062): the four reports (leave-by-employee, requests-by-type/status, outstanding balances,
 * coverage view — SC-007) behind one period filter, each with a CSV export button (papaparse
 * `unparse()` on the currently-loaded rows — client-side export of already-fetched data, matching
 * the task's guidance that no precedent for a server-side export endpoint exists in this codebase).
 * Plain tables, no new UI library — matches ApprovalQueueBoard's minimal-Tailwind convention.
 */
export function ReportsBoard() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const periodFilter = { startDate: startDate || undefined, endDate: endDate || undefined };
  const coverageFilter = {
    startDate: startDate || `${CURRENT_LEAVE_YEAR}-01-01`,
    endDate: endDate || `${CURRENT_LEAVE_YEAR}-12-31`,
  };

  const leaveReport = useLeaveReport(periodFilter);
  const requestsSummary = useRequestsSummary(periodFilter);
  const outstandingBalances = useOutstandingBalances({ leaveYear: CURRENT_LEAVE_YEAR });
  const coverage = useCoverageView(coverageFilter);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-3 rounded border p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">Từ ngày</span>
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">Đến ngày</span>
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Nghỉ phép theo nhân viên</h2>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            disabled={!leaveReport.data || leaveReport.data.rows.length === 0}
            onClick={() =>
              downloadCsv(
                "nghi-phep-theo-nhan-vien.csv",
                (leaveReport.data?.rows ?? []).map((row) => ({
                  "Nhân viên": row.employeeName,
                  "Loại yêu cầu": REQUEST_TYPE_LABEL[row.requestType],
                  "Trạng thái": REQUEST_STATUS_LABEL[row.status],
                  "Từ ngày": row.startDate ?? "",
                  "Đến ngày": row.endDate ?? "",
                  "Số ngày công": row.workingDays ?? "",
                })),
              )
            }
          >
            Xuất CSV
          </button>
        </div>
        {leaveReport.isLoading && <p>Đang tải...</p>}
        {leaveReport.error && <p className="text-red-600">{leaveReport.error.message}</p>}
        {leaveReport.data && leaveReport.data.rows.length === 0 && (
          <p className="text-gray-500">Không có dữ liệu.</p>
        )}
        {leaveReport.data && leaveReport.data.rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1">Nhân viên</th>
                <th className="py-1">Loại yêu cầu</th>
                <th className="py-1">Trạng thái</th>
                <th className="py-1">Thời gian</th>
                <th className="py-1">Số ngày công</th>
              </tr>
            </thead>
            <tbody>
              {leaveReport.data.rows.map((row) => (
                <tr key={row.requestId} className="border-b">
                  <td className="py-1">{row.employeeName}</td>
                  <td className="py-1">{REQUEST_TYPE_LABEL[row.requestType]}</td>
                  <td className="py-1">{REQUEST_STATUS_LABEL[row.status]}</td>
                  <td className="py-1">
                    {row.startDate}
                    {row.endDate && row.endDate !== row.startDate ? ` → ${row.endDate}` : ""}
                  </td>
                  <td className="py-1">{row.workingDays ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Yêu cầu theo loại &amp; trạng thái</h2>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            disabled={!requestsSummary.data || requestsSummary.data.length === 0}
            onClick={() =>
              downloadCsv(
                "yeu-cau-theo-loai-trang-thai.csv",
                (requestsSummary.data ?? []).map((row) => ({
                  "Loại yêu cầu": REQUEST_TYPE_LABEL[row.requestType],
                  "Trạng thái": REQUEST_STATUS_LABEL[row.status],
                  "Số lượng": row.count,
                })),
              )
            }
          >
            Xuất CSV
          </button>
        </div>
        {requestsSummary.isLoading && <p>Đang tải...</p>}
        {requestsSummary.error && <p className="text-red-600">{requestsSummary.error.message}</p>}
        {requestsSummary.data && requestsSummary.data.length === 0 && (
          <p className="text-gray-500">Không có dữ liệu.</p>
        )}
        {requestsSummary.data && requestsSummary.data.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1">Loại yêu cầu</th>
                <th className="py-1">Trạng thái</th>
                <th className="py-1">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {requestsSummary.data.map((row) => (
                <tr key={`${row.requestType}:${row.status}`} className="border-b">
                  <td className="py-1">{REQUEST_TYPE_LABEL[row.requestType]}</td>
                  <td className="py-1">{REQUEST_STATUS_LABEL[row.status]}</td>
                  <td className="py-1">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Số dư phép năm {CURRENT_LEAVE_YEAR}</h2>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            disabled={!outstandingBalances.data || outstandingBalances.data.rows.length === 0}
            onClick={() =>
              downloadCsv(
                "so-du-phep-nam.csv",
                (outstandingBalances.data?.rows ?? []).map((row) => ({
                  "Nhân viên": row.employeeName,
                  "Định mức": row.entitlementDays,
                  "Đã dùng": row.consumedDays,
                  "Điều chỉnh": row.openingAdjustmentDays,
                  "Còn lại": row.remainingDays,
                })),
              )
            }
          >
            Xuất CSV
          </button>
        </div>
        {outstandingBalances.isLoading && <p>Đang tải...</p>}
        {outstandingBalances.error && <p className="text-red-600">{outstandingBalances.error.message}</p>}
        {outstandingBalances.data && outstandingBalances.data.rows.length === 0 && (
          <p className="text-gray-500">Không có dữ liệu.</p>
        )}
        {outstandingBalances.data && outstandingBalances.data.rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1">Nhân viên</th>
                <th className="py-1">Định mức</th>
                <th className="py-1">Đã dùng</th>
                <th className="py-1">Điều chỉnh</th>
                <th className="py-1">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {outstandingBalances.data.rows.map((row) => (
                <tr key={row.employeeId} className="border-b">
                  <td className="py-1">{row.employeeName}</td>
                  <td className="py-1">{row.entitlementDays}</td>
                  <td className="py-1">{row.consumedDays}</td>
                  <td className="py-1">{row.openingAdjustmentDays}</td>
                  <td className="py-1">{row.remainingDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Ai đang nghỉ &amp; ai dạy thay (SC-007)</h2>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            disabled={!coverage.data || coverage.data.rows.length === 0}
            onClick={() =>
              downloadCsv(
                "ai-nghi-ai-day-thay.csv",
                (coverage.data?.rows ?? []).map((row) => ({
                  "Ngày": row.sessionDate,
                  "Người nghỉ": row.offEmployeeName,
                  "Người dạy thay": row.coveringEmployeeName,
                })),
              )
            }
          >
            Xuất CSV
          </button>
        </div>
        {coverage.isLoading && <p>Đang tải...</p>}
        {coverage.error && <p className="text-red-600">{coverage.error.message}</p>}
        {coverage.data && coverage.data.rows.length === 0 && (
          <p className="text-gray-500">Không có buổi dạy nào cần dạy thay trong khoảng thời gian này.</p>
        )}
        {coverage.data && coverage.data.rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1">Ngày</th>
                <th className="py-1">Người nghỉ</th>
                <th className="py-1">Người dạy thay</th>
              </tr>
            </thead>
            <tbody>
              {coverage.data.rows.map((row) => (
                <tr key={`${row.requestId}:${row.classId}:${row.sessionDate}`} className="border-b">
                  <td className="py-1">{row.sessionDate}</td>
                  <td className="py-1">{row.offEmployeeName}</td>
                  <td className="py-1">{row.coveringEmployeeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
