import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { COMMITMENT_THRESHOLDS } from "@/lib/domain/ielts/thresholds";
import { ECOSYSTEM } from "@/lib/domain/ielts/ecosystem";
import { bandLabel } from "@/lib/domain/ielts/labels";
import { PRICE_DISPLAY, formatVnd } from "@/lib/domain/ielts/pricing";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";
import type { SummitDocumentView, SummitStage } from "@/services/ielts/summit-types";
import type { PriceBreakdown } from "@/lib/domain/ielts/pricing-discount";
import { registerBrandFonts, fontFor } from "./fonts";

registerBrandFonts();
const BODY = fontFor("body"); // undefined ⇒ @react-pdf default until the brand TTF is present

export interface SummitPdfMeta {
  consultantName: string;
  consultantPhone: string | null;
  consultantEmail: string | null;
  centreName: string;
  /** Jaxtina logo URL/data — optional so tests render without the asset on disk. */
  logoSrc?: string;
}

const s = StyleSheet.create({
  page: { fontFamily: BODY, fontSize: 10, color: BRAND.color.ink, paddingBottom: 40 },
  cover: { backgroundColor: BRAND.color.navy, color: "#FFFFFF", padding: 28 },
  coverCaveat: {
    marginTop: 12,
    padding: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: BRAND.color.red,
    borderRadius: 4,
  },
  coverCaveatText: { fontSize: 11, fontWeight: 700 as never },
  logo: { width: 160, marginBottom: 12 },
  coverTitle: { fontSize: 20, marginBottom: 8 },
  coverName: { fontSize: 14, marginBottom: 4 },
  coverPrice: { fontSize: 13, marginTop: 6 },
  coverPriceGross: { fontSize: 10, textDecoration: "line-through", opacity: 0.75 },
  section: { padding: 20 },
  h2: { fontSize: 13, color: BRAND.color.navy, marginBottom: 8 },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: { backgroundColor: BRAND.color.navy, color: "#FFFFFF", padding: 4, borderRadius: 3, fontSize: 8 },
  chipDim: { backgroundColor: "#CCCCCC", color: "#555555", padding: 4, borderRadius: 3, fontSize: 8 },
  card: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 4, padding: 10, marginBottom: 8 },
  cardTitle: { fontSize: 11, color: BRAND.color.red, marginBottom: 4 },
  block: { marginBottom: 3 },
  label: { color: BRAND.color.muted },
  compositionRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 4 },
  compositionChip: { backgroundColor: "#EEF0FA", color: BRAND.color.navy, padding: 3, borderRadius: 3, fontSize: 8 },
  threshold: { borderWidth: 1, borderColor: BRAND.color.navy, borderRadius: 4, padding: 10, marginBottom: 8 },
  thresholdTitle: { fontSize: 11, color: BRAND.color.navy, marginBottom: 4 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: BRAND.color.red, color: "#FFFFFF", padding: 8, textAlign: "center", fontSize: 9 },
});

function CourseCard({ stage }: { stage: SummitStage }) {
  const n = stage.narrative;
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardTitle}>
        {stage.name}
        {stage.sessions !== null ? ` — ${stage.sessions} ${SUMMIT_COPY.sessionsUnit}` : ` — ${SUMMIT_COPY.flexibleDuration}`}
        {" · "}
        {SUMMIT_COPY.pdfPriceLabel}: {stage.price !== null ? formatVnd(stage.price) : PRICE_DISPLAY.unpricedLabelVi}
      </Text>
      {stage.composition.length > 0 && (
        <View style={s.compositionRow}>
          {stage.composition.map((line) => (
            <Text key={line} style={s.compositionChip}>{line}</Text>
          ))}
        </View>
      )}
      {n?.family === "booster-achiever" && (
        <View>
          <Text style={s.block}><Text style={s.label}>Học viên bắt đầu ở đâu? </Text>{n.startPoint}</Text>
          <Text style={s.block}><Text style={s.label}>Nút thắt thật sự: </Text>{n.bottleneck}</Text>
          <Text style={s.block}><Text style={s.label}>Khóa học giải quyết: </Text>{n.howItSolves}</Text>
          {n.skillTable.map((row) => (
            <Text key={row.skill} style={s.block}>• {row.skill}: {row.progression} — {row.simple}</Text>
          ))}
          <Text style={s.block}><Text style={s.label}>Sau khóa học: </Text>{n.afterCourse}</Text>
        </View>
      )}
      {n?.family === "foundation" && (
        <View>
          <Text style={s.block}><Text style={s.label}>Nghe & Đọc: </Text>{n.learn.listeningReading}</Text>
          <Text style={s.block}><Text style={s.label}>Viết & Nói: </Text>{n.learn.writingSpeaking}</Text>
          <Text style={s.block}><Text style={s.label}>Từ vựng: </Text>{n.learn.vocabulary}</Text>
          <Text style={s.block}><Text style={s.label}>Ngữ pháp: </Text>{n.learn.grammar}</Text>
          <Text style={s.block}><Text style={s.label}>Mục tiêu: </Text>{n.goal}</Text>
        </View>
      )}
      {n?.family === "intensive" && (
        <View>
          <Text style={s.block}><Text style={s.label}>Đối tượng: </Text>{n.audience}</Text>
          <Text style={s.block}><Text style={s.label}>Mục tiêu: </Text>{n.goal}</Text>
          <Text style={s.block}>NÓI: {n.columns.speaking}</Text>
          <Text style={s.block}>VIẾT: {n.columns.writing}</Text>
          <Text style={s.block}>CHIẾN LƯỢC THI: {n.columns.examStrategy}</Text>
        </View>
      )}
      {n?.family === "support" && <Text style={s.block}>{n.summary}</Text>}
    </View>
  );
}

/**
 * The Summit PDF (spec 005 FR-021 — 6 sections in order). Takes `SummitDocumentView` ONLY, so
 * the internal-only consultant advisory cannot be rendered here (compile-enforced, mirrors
 * 002's StudentRoadmapView barrier). The cover's caveat comes from the SAME
 * `provisionalTreatmentFor` every screen surface uses — one decision point, never a flag
 * threaded separately into this document (Constitution III).
 */
export function SummitDocument({
  view,
  meta,
  totalPriceBreakdown,
}: {
  view: SummitDocumentView;
  meta: SummitPdfMeta;
  totalPriceBreakdown?: PriceBreakdown;
}) {
  const treatment = provisionalTreatmentFor(view.request.placement);
  const climb = view.stages.filter((st) => st.state === "climb");
  const monthsMin = Math.round(view.durationMonths.min);
  const monthsMax = Math.round(view.durationMonths.max);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 1. Cover — provisional caveat prominent when Mode B (Constitution III). */}
        <View style={s.cover}>
          {meta.logoSrc ? <Image style={s.logo} src={meta.logoSrc} /> : null}
          <Text style={s.coverTitle}>{SUMMIT_COPY.pdfCoverTitle}</Text>
          <Text style={s.coverName}>{SUMMIT_COPY.pdfStudentLabel}: {view.request.studentName}</Text>
          <Text style={s.coverName}>
            Band: {bandLabel(view.request.currentBand)} → {bandLabel(view.request.targetBand)}
          </Text>
          <Text style={s.coverName}>
            {SUMMIT_COPY.pdfDurationLabel}: {treatment ? `${treatment.estimatePrefix} ` : ""}
            {monthsMin}–{monthsMax} {SUMMIT_COPY.monthsUnit} · {view.totalSessions} {SUMMIT_COPY.sessionsUnit}
          </Text>
          {totalPriceBreakdown && (
            <Text style={s.coverPrice}>
              {totalPriceBreakdown.hasDiscount && (
                <Text style={s.coverPriceGross}>{formatVnd(totalPriceBreakdown.gross)}  </Text>
              )}
              {SUMMIT_COPY.totalPriceLabel}: {formatVnd(totalPriceBreakdown.net)}
              {totalPriceBreakdown.hasDiscount
                ? ` (${SUMMIT_COPY.discount.offLabel} ${formatVnd(totalPriceBreakdown.off)})`
                : ""}
            </Text>
          )}
          {treatment && (
            <View style={s.coverCaveat}>
              <Text style={s.coverCaveatText}>{treatment.caveat}</Text>
            </View>
          )}
        </View>

        {/* 2. Timeline — the climb, rendered bottom-to-top (Constitution I). */}
        <View style={s.section}>
          <Text style={s.h2}>{SUMMIT_COPY.pdfTimelineTitle}</Text>
          <View style={s.strip}>
            {[...climb].reverse().map((c, i) => (
              <Text key={`${c.code}-${i}`} style={s.chip}>{c.name}</Text>
            ))}
          </View>
        </View>

        {view.consultantNotes ? (
          <View style={s.section}>
            <Text style={s.h2}>{SUMMIT_COPY.consultantNoteLabel}</Text>
            <Text>{view.consultantNotes}</Text>
          </View>
        ) : null}

        {/* 3. Course-by-course cards — narrative, composition, price. */}
        <View style={s.section}>
          <Text style={s.h2}>{SUMMIT_COPY.pdfCourseDetailTitle}</Text>
          {climb.map((c, i) => (
            <CourseCard key={`${c.code}-card-${i}`} stage={c} />
          ))}
        </View>

        {/* 4. Commitments — both thresholds, distinct (SC-005/FR-026). */}
        <View style={s.section}>
          <Text style={s.h2}>Cam kết đầu ra & điều kiện</Text>
          {COMMITMENT_THRESHOLDS.map((t) => (
            <View key={t.key} style={s.threshold}>
              <Text style={s.thresholdTitle}>{t.title}</Text>
              {t.conditions.map((c, i) => (
                <Text key={i} style={s.block}>• {c}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* 5. Ecosystem. */}
        <View style={s.section}>
          <Text style={s.h2}>Hệ sinh thái hỗ trợ</Text>
          {ECOSYSTEM.map((e) => (
            <Text key={e.name} style={s.block}>• {e.name}: {e.description}</Text>
          ))}
        </View>

        {/* 6. Contact block. */}
        <View style={s.section}>
          <Text style={s.h2}>Liên hệ tư vấn viên</Text>
          <Text style={s.block}>{meta.consultantName}</Text>
          {meta.consultantPhone ? <Text style={s.block}>ĐT: {meta.consultantPhone}</Text> : null}
          {meta.consultantEmail ? <Text style={s.block}>Email: {meta.consultantEmail}</Text> : null}
          <Text style={s.block}>Trung tâm: {meta.centreName}</Text>
        </View>

        <Text style={s.footer} fixed>{BRAND.footer.text}</Text>
      </Page>
    </Document>
  );
}
