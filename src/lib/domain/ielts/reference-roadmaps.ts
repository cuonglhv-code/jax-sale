/**
 * Reference roadmaps by audience (official deck slide 42) — the VALIDATION BASELINE (spec SC-003).
 * The engine's output for a given audience at its reference entry/target must land within the stated
 * duration range, or a divergence must be documented. Content data — not logic.
 */

import type { Audience } from "./labels";
import type { CourseCode } from "./courses";
import type { Band } from "./bands";

export interface ReferenceRoadmap {
  audience: Audience;
  path: CourseCode[]; // parenthesised/optional rungs included
  minMonths: number;
  maxMonths: number;
  targetLow: Band;
  targetHigh: Band;
  /** Representative entry/target used by the SC-003 range check. */
  refEntry: Band;
  refTarget: Band;
}

// The 5 form audiences map to their deck reference paths. ("Muốn bứt phá" — A2→A3→Luyện đề,
// 4–6 months, 7.0–8.0+ — is an aspirational profile in the deck, NOT one of the 5 form segments,
// so it is intentionally not keyed to an Audience here.)
export const REFERENCE_ROADMAPS: readonly ReferenceRoadmap[] = [
  { audience: "MAT_GOC", path: ["PRE_S", "IF1", "IF2", "B1", "B2", "A1", "A2"], minMonths: 18, maxMonths: 24, targetLow: "6.0", targetHigh: "6.5", refEntry: "~A1", refTarget: "6.5" },
  { audience: "THCS", path: ["GP", "IF2", "B1", "B2", "A1", "A2", "A3"], minMonths: 15, maxMonths: 18, targetLow: "6.5", targetHigh: "7.5", refEntry: "2.5", refTarget: "6.5" },
  { audience: "THPT", path: ["B1", "B2", "A1", "A2", "A3", "INT"], minMonths: 10, maxMonths: 13, targetLow: "6.5", targetHigh: "7.5", refEntry: "3.5", refTarget: "7.0" },
  { audience: "SINH_VIEN", path: ["B2", "A1", "A2", "INT"], minMonths: 6, maxMonths: 7, targetLow: "6.0", targetHigh: "6.5", refEntry: "4.5", refTarget: "6.5" },
  { audience: "NGUOI_DI_LAM", path: ["IF2", "B1", "B2", "A1"], minMonths: 8, maxMonths: 9, targetLow: "6.0", targetHigh: "6.0", refEntry: "2.5", refTarget: "6.0" },
];

export function referenceFor(audience: Audience): ReferenceRoadmap | undefined {
  return REFERENCE_ROADMAPS.find((r) => r.audience === audience);
}
