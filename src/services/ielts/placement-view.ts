/**
 * THE single decision point for provisional rendering (spec 005 Constitution III;
 * contracts/presentation.md §Mode rendering). Every surface — Mountain, Summary, the Summit
 * caveat banner, and the PDF cover — calls `provisionalTreatmentFor(placement)` directly with
 * the real `Placement` value; none may accept a separately-settable boolean instead. The
 * `estimated` branch of the exhaustive switch IS the caveat: there is no code path that reaches
 * a render without it when the placement is estimated, and `assertNever` makes a missed branch
 * a compile error if `Placement` ever grows a third variant.
 */

import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { assertNever, type Placement } from "./summit-types";

export interface ProvisionalTreatment {
  caveat: string;
  marker: string;
  estimatePrefix: string;
  cta: string;
}

/** null for a measured placement (no treatment); a full treatment for an estimated one. */
export function provisionalTreatmentFor(placement: Placement): ProvisionalTreatment | null {
  switch (placement.kind) {
    case "measured":
      return null;
    case "estimated":
      return {
        caveat: SUMMIT_COPY.provisionalCaveat,
        marker: SUMMIT_COPY.provisionalMarker,
        estimatePrefix: SUMMIT_COPY.provisionalEstimatePrefix,
        cta: SUMMIT_COPY.bookPlacementCta,
      };
    default:
      return assertNever(placement);
  }
}

export function isEstimated(placement: Placement): boolean {
  return provisionalTreatmentFor(placement) !== null;
}
