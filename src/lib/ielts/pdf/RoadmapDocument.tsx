import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { BRAND } from "@/lib/domain/ielts/brand";
import { COMMITMENT_THRESHOLDS } from "@/lib/domain/ielts/thresholds";
import { ECOSYSTEM } from "@/lib/domain/ielts/ecosystem";
import type { StudentRoadmapView } from "@/services/ielts/types";
import type { RoadmapCourse } from "@/services/ielts/types";
import { registerBrandFonts, fontFor } from "./fonts";

registerBrandFonts();
const BODY = fontFor("body"); // undefined ⇒ @react-pdf default until the brand TTF is present

export interface RoadmapPdfMeta {
  studentName: string;
  currentBandLabel: string;
  targetBandLabel: string;
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
  logo: { width: 160, marginBottom: 12 },
  coverTitle: { fontSize: 20, marginBottom: 8 },
  coverName: { fontSize: 14, marginBottom: 4 },
  section: { padding: 20 },
  h2: { fontSize: 13, color: BRAND.color.navy, marginBottom: 8 },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: { backgroundColor: BRAND.color.navy, color: "#FFFFFF", padding: 4, borderRadius: 3, fontSize: 8 },
  card: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 4, padding: 10, marginBottom: 8 },
  cardTitle: { fontSize: 11, color: BRAND.color.red, marginBottom: 4 },
  block: { marginBottom: 3 },
  label: { color: BRAND.color.muted },
  threshold: { borderWidth: 1, borderColor: BRAND.color.navy, borderRadius: 4, padding: 10, marginBottom: 8 },
  thresholdTitle: { fontSize: 11, color: BRAND.color.navy, marginBottom: 4 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: BRAND.color.red, color: "#FFFFFF", padding: 8, textAlign: "center", fontSize: 9 },
});

function CourseCard({ course }: { course: RoadmapCourse }) {
  const n = course.narrative;
  return (
    <View style={s.card} wrap={false}>
      <Text style={s.cardTitle}>
        {course.name} — {course.sessions} buổi{course.sessionsProvisional ? " (dự kiến)" : ""}
      </Text>
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
 * The branded student PDF (spec §PDF; 6 sections in order — AC-6.1). Accepts `StudentRoadmapView`
 * ONLY, so the internal deadline warning cannot be rendered here (SC-006, compile-enforced).
 */
export function RoadmapDocument({ view, meta }: { view: StudentRoadmapView; meta: RoadmapPdfMeta }) {
  const months = view.totalMonths ? Math.round(view.totalMonths) : null;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 1. Cover */}
        <View style={s.cover}>
          {meta.logoSrc ? <Image style={s.logo} src={meta.logoSrc} /> : null}
          <Text style={s.coverTitle}>Lộ trình học IELTS cá nhân hoá</Text>
          <Text style={s.coverName}>Học viên: {meta.studentName}</Text>
          <Text style={s.coverName}>Band: {meta.currentBandLabel} → {meta.targetBandLabel}</Text>
          <Text style={s.coverName}>
            Tổng thời gian dự kiến: {months !== null ? `${months} tháng` : "—"} · {view.totalSessions} buổi
          </Text>
        </View>

        {/* 2. Timeline strip */}
        <View style={s.section}>
          <Text style={s.h2}>Lộ trình khóa học</Text>
          <View style={s.strip}>
            {view.courses.map((c, i) => (
              <Text key={`${c.code}-${i}`} style={s.chip}>{c.name}</Text>
            ))}
          </View>
        </View>

        {view.consultantNotes ? (
          <View style={s.section}>
            <Text style={s.h2}>Ghi chú từ tư vấn viên</Text>
            <Text>{view.consultantNotes}</Text>
          </View>
        ) : null}

        {/* 3. Course-by-course cards */}
        <View style={s.section}>
          <Text style={s.h2}>Chi tiết từng khóa</Text>
          {view.courses.map((c, i) => (
            <CourseCard key={`${c.code}-card-${i}`} course={c} />
          ))}
        </View>

        {/* 4. Commitments — both thresholds, distinct (SC-007) */}
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

        {/* 5. Ecosystem */}
        <View style={s.section}>
          <Text style={s.h2}>Hệ sinh thái hỗ trợ</Text>
          {ECOSYSTEM.map((e) => (
            <Text key={e.name} style={s.block}>• {e.name}: {e.description}</Text>
          ))}
        </View>

        {/* 6. Contact block */}
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
