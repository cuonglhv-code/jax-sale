import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { RoadmapDocument, type RoadmapPdfMeta } from "@/lib/ielts/pdf/RoadmapDocument";
import { generateRoadmap, toStudentView } from "@/services/ielts/roadmap-engine";
import type { RoadmapRequest } from "@/services/ielts/types";

// One-off verification that the Jaxtina logo actually embeds into the PDF.
const req: RoadmapRequest = {
  studentName: "Nguyễn Văn A", audience: "THPT", studentEmail: "a@e.com", studentPhone: null,
  currentBand: "3.5", targetBand: "6.5", examPurpose: "XET_TUYEN_DH", targetExamDate: null,
  intensity: "TIEU_CHUAN", consultantName: "TV", consultantPhone: null, consultantEmail: null,
  centreId: "x", startDate: "2026-01-01",
};
const base: RoadmapPdfMeta = {
  studentName: "Nguyễn Văn A", currentBandLabel: "3.5", targetBandLabel: "6.5",
  consultantName: "TV", consultantPhone: null, consultantEmail: null, centreName: "Q1",
};

describe("pdf: Jaxtina logo embeds", () => {
  it("embeds the logo (PDF grows by ~image size when logo present)", async () => {
    const view = toStudentView(generateRoadmap(req));
    const logoDataUri =
      "data:image/png;base64," + readFileSync("public/ielts/jaxtina-logo.png").toString("base64");

    const without = await renderToBuffer(<RoadmapDocument view={view} meta={base} />);
    const withLogo = await renderToBuffer(
      <RoadmapDocument view={view} meta={{ ...base, logoSrc: logoDataUri }} />,
    );

    expect(withLogo.subarray(0, 4).toString("latin1")).toBe("%PDF");
    // The embedded PNG (~47KB) should make the PDF meaningfully larger.
    expect(withLogo.length).toBeGreaterThan(without.length + 20_000);
  }, 30_000);
});
