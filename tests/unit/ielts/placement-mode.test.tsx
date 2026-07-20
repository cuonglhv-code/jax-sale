/**
 * T017 — Mode rendering (Constitution III, contracts/presentation.md §Mode rendering). Every
 * surface derives its provisional treatment from `provisionalTreatmentFor`, so this suite tests
 * that single source directly: it is what Mountain, SummarySurface, Summit, and the PDF cover
 * all call. Estimated renders the exact named caveat + estimate framing + CTA; measured renders
 * none of it; recording a placement result flips the treatment to null everywhere at once.
 */

import { describe, it, expect } from "vitest";
import { provisionalTreatmentFor, isEstimated } from "@/services/ielts/placement-view";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { summitReducer, INITIAL_SUMMIT_STATE } from "@/app/(app)/lo-trinh-ielts/summit-state";
import type { Placement } from "@/services/ielts/summit-types";

describe("provisionalTreatmentFor: estimated (Mode B)", () => {
  const treatment = provisionalTreatmentFor({ kind: "estimated" });

  it("returns the exact named caveat string (Constitution III)", () => {
    expect(treatment?.caveat).toBe(
      "Lộ trình dự kiến — cần xác nhận bằng kết quả test đầu vào",
    );
    expect(treatment?.caveat).toBe(SUMMIT_COPY.provisionalCaveat);
  });

  it("carries the estimate-framing prefix and the book-a-test CTA", () => {
    expect(treatment?.estimatePrefix).toBe(SUMMIT_COPY.provisionalEstimatePrefix);
    expect(treatment?.cta).toBe(SUMMIT_COPY.bookPlacementCta);
    expect(treatment?.marker).toBe(SUMMIT_COPY.provisionalMarker);
  });

  it("isEstimated() is true", () => {
    expect(isEstimated({ kind: "estimated" })).toBe(true);
  });
});

describe("provisionalTreatmentFor: measured (Mode A)", () => {
  it("returns null — no caveat, no estimate framing, no CTA renders", () => {
    expect(provisionalTreatmentFor({ kind: "measured", testDate: null })).toBeNull();
    expect(provisionalTreatmentFor({ kind: "measured", testDate: "2026-07-15" })).toBeNull();
  });

  it("isEstimated() is false", () => {
    expect(isEstimated({ kind: "measured", testDate: null })).toBe(false);
  });
});

describe("estimated → measured clears the treatment everywhere at once", () => {
  it("recordPlacementResult flips a fresh Placement that renders no treatment", () => {
    const estimated: Placement = { kind: "estimated" };
    expect(provisionalTreatmentFor(estimated)).not.toBeNull();

    const state = summitReducer(
      { ...INITIAL_SUMMIT_STATE, placement: estimated },
      { type: "recordPlacementResult", testDate: "2026-07-15" },
    );
    expect(provisionalTreatmentFor(state.placement)).toBeNull();
  });
});
