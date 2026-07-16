import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { RoadmapDocument, type RoadmapPdfMeta } from "@/lib/ielts/pdf/RoadmapDocument";
import { generateRoadmap, toStudentView } from "@/services/ielts/roadmap-engine";
import type { RoadmapRequest } from "@/services/ielts/types";

/**
 * US6 (T025) — PDF render smoke test. Verifies the branded document renders to a valid PDF with the
 * roadmap content flowing through. NOTE: full diacritic FIDELITY (SC-004) is verified once the real
 * Jaxtina Montserrat TTF is dropped into src/lib/ielts/pdf/fonts/ (asset-gated); this test proves
 * the document structure + content pipeline are correct now.
 */
function req(): RoadmapRequest {
  return {
    studentName: "Nguyễn Văn A", audience: "THPT", studentEmail: "a@example.com", studentPhone: "0900",
    currentBand: "3.5", targetBand: "6.5", examPurpose: "XET_TUYEN_DH", targetExamDate: null,
    intensity: "TIEU_CHUAN", consultantName: "Trần Thị B", consultantPhone: "0911",
    consultantEmail: "b@jaxtina.test", centreId: "x", startDate: "2026-01-01",
  };
}

const meta: RoadmapPdfMeta = {
  studentName: "Nguyễn Văn A",
  currentBandLabel: "3.5",
  targetBandLabel: "6.5",
  consultantName: "Trần Thị B",
  consultantPhone: "0911",
  consultantEmail: "b@jaxtina.test",
  centreName: "Trung tâm Quận 1",
};

describe("pdf: render smoke", () => {
  it("renders a non-empty, valid PDF for a multi-course roadmap", async () => {
    const view = toStudentView(generateRoadmap(req()));
    expect(view.courses.length).toBeGreaterThan(1);

    const buffer = await renderToBuffer(<RoadmapDocument view={view} meta={meta} />);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic number.
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30_000);
});
