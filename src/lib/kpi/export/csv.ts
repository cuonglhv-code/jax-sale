import type { KpiDashboardRow } from "@/lib/data/types";
import { METRIC_LABEL, ATTAINMENT_STATE_LABEL } from "@/lib/domain/vocabulary";

/**
 * US5 (FR-VIS-04, AC-5.1/5.3/5.4): build a CSV export from tier-confined dashboard rows. Vietnamese
 * headers, correct diacritics (plain UTF-8 text — no font/rendering concern for CSV). Stamped with
 * period/scope/timestamp per AC-5.4.
 */
export function buildKpiCsv(
  rows: readonly KpiDashboardRow[],
  period: string,
  scope: string,
  generatedAt: string,
): string {
  const header = ["Tư vấn viên", "Chỉ số", "Kết quả (đã duyệt)", "Mục tiêu", "Mức đạt"];
  const meta = [`Kỳ: ${period}`, `Phạm vi: ${scope}`, `Thời điểm xuất: ${generatedAt}`];

  const lines: string[] = [...meta, "", header.map(csvEscape).join(",")];
  for (const row of rows) {
    for (const attainment of row.attainments) {
      lines.push(
        [
          row.scopeName,
          METRIC_LABEL[attainment.metricKey],
          String(attainment.approvedActual),
          attainment.target === null ? "" : String(attainment.target),
          ATTAINMENT_STATE_LABEL[attainment.state],
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
