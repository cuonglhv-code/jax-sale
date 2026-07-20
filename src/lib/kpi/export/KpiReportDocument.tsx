import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { KpiDashboardRow } from "@/lib/data/types";
import { METRIC_LABEL, ATTAINMENT_STATE_LABEL } from "@/lib/domain/vocabulary";
import { registerBrandFonts, fontFor } from "@/lib/ielts/pdf/fonts";

registerBrandFonts();
const BODY = fontFor("body"); // undefined ⇒ @react-pdf default until brand TTFs are present (#002 pattern)

const s = StyleSheet.create({
  page: { fontFamily: BODY, fontSize: 10, padding: 28 },
  title: { fontSize: 16, marginBottom: 4 },
  meta: { fontSize: 9, color: "#666666", marginBottom: 12 },
  table: { marginTop: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E0E0E0", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#333333", paddingVertical: 4 },
  cell: { flex: 1, fontSize: 9 },
  headerCell: { flex: 1, fontSize: 9, fontWeight: 700 as never },
});

export interface KpiReportMeta {
  period: string;
  scope: string;
  generatedAt: string;
}

/** US5 (FR-VIS-04, AC-5.1/5.3): a simple one-page branded PDF summary of tier-confined KPI rows. */
export function KpiReportDocument({ rows, meta }: { rows: readonly KpiDashboardRow[]; meta: KpiReportMeta }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Báo cáo hiệu suất & KPI</Text>
        <Text style={s.meta}>
          Kỳ: {meta.period} · Phạm vi: {meta.scope} · Thời điểm xuất: {meta.generatedAt}
        </Text>
        <View style={s.table}>
          <View style={s.headerRow}>
            <Text style={s.headerCell}>Tư vấn viên</Text>
            <Text style={s.headerCell}>Chỉ số</Text>
            <Text style={s.headerCell}>Kết quả (đã duyệt)</Text>
            <Text style={s.headerCell}>Mục tiêu</Text>
            <Text style={s.headerCell}>Mức đạt</Text>
          </View>
          {rows.map((row) =>
            row.attainments.map((a) => (
              <View key={`${row.scopeId}-${a.metricKey}`} style={s.row}>
                <Text style={s.cell}>{row.scopeName}</Text>
                <Text style={s.cell}>{METRIC_LABEL[a.metricKey]}</Text>
                <Text style={s.cell}>{a.approvedActual.toLocaleString("vi-VN")}</Text>
                <Text style={s.cell}>{a.target === null ? "—" : a.target.toLocaleString("vi-VN")}</Text>
                <Text style={s.cell}>{ATTAINMENT_STATE_LABEL[a.state]}</Text>
              </View>
            )),
          )}
        </View>
      </Page>
    </Document>
  );
}
