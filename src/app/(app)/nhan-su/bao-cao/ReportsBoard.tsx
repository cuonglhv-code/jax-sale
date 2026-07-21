"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { unparse } from "papaparse";
import { useLeaveReport } from "@/hooks/queries/hr/useLeaveReport";
import { useRequestsSummary } from "@/hooks/queries/hr/useRequestsSummary";
import { useOutstandingBalances } from "@/hooks/queries/hr/useOutstandingBalances";
import { useCoverageView } from "@/hooks/queries/hr/useCoverageView";
import { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR, ALL_CENTRES } from "@/lib/domain/vocabulary";
import type { RequestStatus } from "@/lib/data/types";

const CURRENT_LEAVE_YEAR = new Date().getFullYear();

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

function StatusBadge({ status, label }: { status: RequestStatus; label: string }) {
  const color = REQUEST_STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
      style={{ color: color.text, background: color.bg, borderColor: color.border }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
      {label}
    </span>
  );
}

interface ReportSectionProps {
  title: string;
  count: number;
  countLabel: string;
  isExporting: boolean;
  onExport: () => void;
  children: React.ReactNode;
}

function ReportSection({ title, count, countLabel, isExporting, onExport, children }: ReportSectionProps) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">{title}</h2>
        <span className="text-xs font-medium text-text-faint">
          {count} {countLabel}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="inline-flex h-8 items-center gap-[7px] rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-3 disabled:cursor-default disabled:opacity-75"
        >
          {isExporting && (
            <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-border-strong" style={{ borderTopColor: "var(--color-navy)" }} />
          )}
          {isExporting ? "Đang xuất…" : "Xuất CSV"}
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/** US8 (T062): the four reports (leave-by-employee, requests-by-type/status, outstanding balances,
 *  coverage view — SC-007) sharing one period filter, matching design_handoff_jax_sales' card
 *  layout (red-tick header, zebra table, per-section export). Centre narrowing (super_admin only)
 *  follows the shell's `?centre=` param, same as Tasks/KPI. */
export function ReportsBoard() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState<Record<string, boolean>>({});
  const [r1SortDir, setR1SortDir] = useState<"none" | "asc" | "desc">("none");
  const searchParams = useSearchParams();
  const centreParam = searchParams.get("centre");
  const centreId = centreParam && centreParam !== ALL_CENTRES ? centreParam : undefined;

  const periodFilter = { startDate: startDate || undefined, endDate: endDate || undefined };
  const coverageFilter = {
    startDate: startDate || `${CURRENT_LEAVE_YEAR}-01-01`,
    endDate: endDate || `${CURRENT_LEAVE_YEAR}-12-31`,
  };

  const leaveReport = useLeaveReport(periodFilter, centreId);
  const requestsSummary = useRequestsSummary(periodFilter, centreId);
  const outstandingBalances = useOutstandingBalances({ leaveYear: CURRENT_LEAVE_YEAR }, centreId);
  const coverage = useCoverageView(coverageFilter, centreId);

  const sortedLeaveRows = useMemo(() => {
    const rows = leaveReport.data?.rows ?? [];
    if (r1SortDir === "none") return rows;
    return [...rows].sort((a, b) => {
      const diff = (a.workingDays ?? 0) - (b.workingDays ?? 0);
      return r1SortDir === "asc" ? diff : -diff;
    });
  }, [leaveReport.data, r1SortDir]);

  function toggleSort() {
    setR1SortDir((d) => (d === "desc" ? "asc" : "desc"));
  }
  const sortArrow = r1SortDir === "asc" ? "▲" : r1SortDir === "desc" ? "▼" : "⇅";

  function exportSection(key: string, fileName: string, rows: readonly Record<string, unknown>[]) {
    setExporting((e) => ({ ...e, [key]: true }));
    downloadCsv(fileName, rows);
    setTimeout(() => setExporting((e) => ({ ...e, [key]: false })), 600);
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-5 pb-8">
      <div className="flex flex-wrap items-end gap-3.5 rounded-[var(--radius-panel)] border border-border bg-surface p-4">
        <label className="flex flex-col gap-[5px] text-[11.5px] font-semibold text-text-muted">
          Từ ngày
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
          />
        </label>
        <label className="flex flex-col gap-[5px] text-[11.5px] font-semibold text-text-muted">
          Đến ngày
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
          />
        </label>
      </div>

      <ReportSection
        title="Nghỉ phép theo nhân viên"
        count={sortedLeaveRows.length}
        countLabel="nhân viên"
        isExporting={!!exporting.r1}
        onExport={() =>
          exportSection(
            "r1",
            "nghi-phep-theo-nhan-vien.csv",
            sortedLeaveRows.map((row) => ({
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
        {leaveReport.isLoading && <p className="p-4 text-text-muted">Đang tải...</p>}
        {leaveReport.error && <p className="p-4 text-red">{leaveReport.error.message}</p>}
        {sortedLeaveRows.length === 0 && !leaveReport.isLoading ? (
          <p className="p-4 text-text-faint">Không có dữ liệu.</p>
        ) : (
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <Th align="left">Nhân viên</Th>
                <Th align="left">Loại yêu cầu</Th>
                <Th align="left">Trạng thái</Th>
                <Th align="left">Thời gian</Th>
                <Th align="right" onClick={toggleSort} sortable>
                  Số ngày công {sortArrow}
                </Th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaveRows.map((row, i) => (
                <tr key={row.requestId} className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}>
                  <Td strong>{row.employeeName}</Td>
                  <Td muted>{REQUEST_TYPE_LABEL[row.requestType]}</Td>
                  <Td>
                    <StatusBadge status={row.status} label={REQUEST_STATUS_LABEL[row.status]} />
                  </Td>
                  <Td muted tabular>
                    {row.startDate}
                    {row.endDate && row.endDate !== row.startDate ? ` → ${row.endDate}` : ""}
                  </Td>
                  <Td align="right" strong tabular>
                    {row.workingDays ?? "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSection>

      <ReportSection
        title="Yêu cầu theo loại & trạng thái"
        count={requestsSummary.data?.reduce((sum, r) => sum + r.count, 0) ?? 0}
        countLabel="yêu cầu"
        isExporting={!!exporting.r2}
        onExport={() =>
          exportSection(
            "r2",
            "yeu-cau-theo-loai-trang-thai.csv",
            (requestsSummary.data ?? []).map((row) => ({
              "Loại yêu cầu": REQUEST_TYPE_LABEL[row.requestType],
              "Trạng thái": REQUEST_STATUS_LABEL[row.status],
              "Số lượng": row.count,
            })),
          )
        }
      >
        {requestsSummary.isLoading && <p className="p-4 text-text-muted">Đang tải...</p>}
        {requestsSummary.error && <p className="p-4 text-red">{requestsSummary.error.message}</p>}
        {(!requestsSummary.data || requestsSummary.data.length === 0) && !requestsSummary.isLoading ? (
          <p className="p-4 text-text-faint">Không có dữ liệu.</p>
        ) : (
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <Th align="left">Loại yêu cầu</Th>
                <Th align="left">Trạng thái</Th>
                <Th align="right">Số lượng</Th>
              </tr>
            </thead>
            <tbody>
              {(requestsSummary.data ?? []).map((row, i) => (
                <tr key={`${row.requestType}:${row.status}`} className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}>
                  <Td strong>{REQUEST_TYPE_LABEL[row.requestType]}</Td>
                  <Td>
                    <StatusBadge status={row.status} label={REQUEST_STATUS_LABEL[row.status]} />
                  </Td>
                  <Td align="right" strong tabular>
                    {row.count}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSection>

      <ReportSection
        title={`Số dư phép năm ${CURRENT_LEAVE_YEAR}`}
        count={outstandingBalances.data?.rows.length ?? 0}
        countLabel="nhân viên"
        isExporting={!!exporting.r3}
        onExport={() =>
          exportSection(
            "r3",
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
        {outstandingBalances.isLoading && <p className="p-4 text-text-muted">Đang tải...</p>}
        {outstandingBalances.error && <p className="p-4 text-red">{outstandingBalances.error.message}</p>}
        {(!outstandingBalances.data || outstandingBalances.data.rows.length === 0) && !outstandingBalances.isLoading ? (
          <p className="p-4 text-text-faint">Không có dữ liệu.</p>
        ) : (
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <Th align="left">Nhân viên</Th>
                <Th align="right">Định mức</Th>
                <Th align="right">Đã dùng</Th>
                <Th align="right">Điều chỉnh</Th>
                <Th align="right">Còn lại</Th>
              </tr>
            </thead>
            <tbody>
              {(outstandingBalances.data?.rows ?? []).map((row, i) => (
                <tr key={row.employeeId} className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}>
                  <Td strong>{row.employeeName}</Td>
                  <Td align="right" muted tabular>
                    {row.entitlementDays}
                  </Td>
                  <Td align="right" muted tabular>
                    {row.consumedDays}
                  </Td>
                  <Td align="right" muted tabular>
                    {row.openingAdjustmentDays}
                  </Td>
                  <Td align="right" strong tabular>
                    {row.remainingDays}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSection>

      <ReportSection
        title="Ai đang nghỉ & ai dạy thay"
        count={coverage.data?.rows.length ?? 0}
        countLabel="trường hợp"
        isExporting={!!exporting.r4}
        onExport={() =>
          exportSection(
            "r4",
            "ai-nghi-ai-day-thay.csv",
            (coverage.data?.rows ?? []).map((row) => ({
              Ngày: row.sessionDate,
              "Người nghỉ": row.offEmployeeName,
              "Người dạy thay": row.coveringEmployeeName,
            })),
          )
        }
      >
        {coverage.isLoading && <p className="p-4 text-text-muted">Đang tải...</p>}
        {coverage.error && <p className="p-4 text-red">{coverage.error.message}</p>}
        {(!coverage.data || coverage.data.rows.length === 0) && !coverage.isLoading ? (
          <p className="p-4 text-text-faint">Không có buổi dạy nào cần dạy thay trong khoảng thời gian này.</p>
        ) : (
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2">
                <Th align="left">Ngày</Th>
                <Th align="left">Người nghỉ</Th>
                <Th align="left">Người dạy thay</Th>
              </tr>
            </thead>
            <tbody>
              {(coverage.data?.rows ?? []).map((row, i) => (
                <tr
                  key={`${row.requestId}:${row.classId}:${row.sessionDate}`}
                  className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}
                >
                  <Td muted tabular>
                    {row.sessionDate}
                  </Td>
                  <Td strong>{row.offEmployeeName}</Td>
                  <Td>{row.coveringEmployeeName}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportSection>
    </div>
  );
}

function Th({
  children,
  align = "left",
  sortable,
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`border-b border-border px-4 py-[9px] text-[11px] font-bold uppercase tracking-[.04em] text-text-muted ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${sortable ? "cursor-pointer select-none whitespace-nowrap transition-colors hover:text-navy" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  strong,
  muted,
  tabular,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  strong?: boolean;
  muted?: boolean;
  tabular?: boolean;
}) {
  return (
    <td
      className={`border-b border-border px-4 py-2.5 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${
        strong ? "font-semibold text-text" : muted ? "text-text-muted" : "text-text"
      } ${tabular ? "[font-variant-numeric:tabular-nums]" : ""}`}
    >
      {children}
    </td>
  );
}
