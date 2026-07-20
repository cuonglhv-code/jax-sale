/**
 * Journey-matched proof (spec 005 FR-018, contracts/summit-engine.md §matchProof). Pure —
 * accepts only `ConsentedProof[]` (the module's only export), so passing unconsented data is
 * untypeable, not merely discouraged (Constitution IX).
 */

import { bandValue, type Band } from "@/lib/domain/ielts/bands";
import type { ConsentedProof } from "@/lib/domain/ielts/proof";

export interface ProofMatch {
  proof: ConsentedProof;
  matchKind: "exact" | "nearest";
}

export interface ClimbJourney {
  startBand: Band;
  targetBand: Band;
}

/** |startΔ| + |resultΔ| in band-order indices; ties keep the pool's editorial order. */
function journeyDistance(proof: ConsentedProof, journey: ClimbJourney): number {
  const startDelta = Math.abs(bandValue(proof.startBand) - bandValue(journey.startBand));
  const resultDelta = Math.abs(bandValue(proof.resultBand) - bandValue(journey.targetBand));
  return startDelta + resultDelta;
}

/** Ordered best-first; exact (distance 0) before nearest; nearest never labelled exact. */
export function matchProof(
  journey: ClimbJourney,
  pool: readonly ConsentedProof[],
): ProofMatch[] {
  return pool
    .map((proof, editorialIndex) => ({ proof, editorialIndex, distance: journeyDistance(proof, journey) }))
    .sort((a, b) => a.distance - b.distance || a.editorialIndex - b.editorialIndex)
    .map(({ proof, distance }) => ({ proof, matchKind: distance === 0 ? "exact" : "nearest" }));
}
