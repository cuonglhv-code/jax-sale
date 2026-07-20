"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { exportReport } from "@/app/actions/kpi/export-report";
import { buildKpiCsv } from "@/lib/kpi/export/csv";
import { KpiReportDocument } from "@/lib/kpi/export/KpiReportDocument";

/** US5 (AC-5.1/5.4): export the current period as CSV + a branded PDF summary. */
export function ExportButton({ period }: { period: string }) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const result = await exportReport(period);
      if ("error" in result) throw new Error(result.error);
      const { rows, scope } = result.data;
      const generatedAt = new Date().toISOString();

      const csv = buildKpiCsv(rows, period, scope, generatedAt);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `kpi-${period}.csv`);

      const pdfBlob = await pdf(
        <KpiReportDocument rows={rows} meta={{ period, scope, generatedAt }} />,
      ).toBlob();
      downloadBlob(pdfBlob, `kpi-${period}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="rounded bg-gray-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {isExporting ? "Đang xuất..." : "Xuất báo cáo (CSV + PDF)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
