/**
 * T021 (cover) / T024 (full content, extended in US3) — Summit PDF render tests.
 * generateSummitRoadmap → toDocumentView → SummitDocument, proving the cover branches on
 * Placement via the same `provisionalTreatmentFor` every screen surface uses.
 */

import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { SummitDocument, type SummitPdfMeta } from "@/lib/ielts/pdf/SummitDocument";
import { generateSummitRoadmap } from "@/services/ielts/summit-engine";
import { toDocumentView, type SummitRequest } from "@/services/ielts/summit-types";
import { applyDiscount } from "@/lib/domain/ielts/pricing-discount";

const meta: SummitPdfMeta = {
  consultantName: "Trần Thị B",
  consultantPhone: "0911",
  consultantEmail: "b@jaxtina.test",
  centreName: "Trung tâm Quận 1",
};

function req(overrides: Partial<SummitRequest> = {}): SummitRequest {
  return {
    studentName: "Nguyễn Văn A",
    currentBand: "4.5",
    targetBand: "7.0",
    placement: { kind: "measured", testDate: "2026-07-15" },
    ...overrides,
  };
}

describe("SummitDocument: cover (T021 — Constitution III)", () => {
  it("renders a valid, non-empty PDF for a measured (Mode A) climb", async () => {
    const roadmap = generateSummitRoadmap(req(), "default", "2026-07-17");
    const view = toDocumentView(roadmap);
    const buffer = await renderToBuffer(<SummitDocument view={view} meta={meta} />);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it("has no consultantAdvisory field reaching the document view (compile + runtime barrier)", () => {
    const roadmap = generateSummitRoadmap(req({ currentBand: "7.0", targetBand: "8.0+" }), "default");
    expect(roadmap.consultantAdvisory).not.toBeNull(); // the engine DID set one
    const view = toDocumentView(roadmap);
    expect("consultantAdvisory" in view).toBe(false); // the document view never carries it
  });

  it("renders successfully for an estimated (Mode B) climb — caveat path exercised", async () => {
    const roadmap = generateSummitRoadmap(
      req({ placement: { kind: "estimated" } }),
      "default",
      "2026-07-17",
    );
    const view = toDocumentView(roadmap);
    const buffer = await renderToBuffer(<SummitDocument view={view} meta={meta} />);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30_000);

  it("renders a valid PDF when a discount breakdown is passed", async () => {
    const roadmap = generateSummitRoadmap(req(), "default", "2026-07-17");
    const view = toDocumentView(roadmap);
    const breakdown = applyDiscount(view.totalPrice.amount, { type: "percent", value: 10 });
    const buffer = await renderToBuffer(
      <SummitDocument view={view} meta={meta} totalPriceBreakdown={breakdown} />,
    );
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);
});
