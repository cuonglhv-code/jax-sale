/** Narrative content store — maps a course's `narrativeKey` to its content. Content data, no logic. */

import type { CourseNarrative } from "./types";
import { BOOSTER_ACHIEVER } from "./booster-achiever";
import { FOUNDATION } from "./foundation";
import { INTENSIVE } from "./intensive";
import { SUPPORT } from "./pre-s-gp";

const NARRATIVE: Record<string, CourseNarrative> = {
  ...BOOSTER_ACHIEVER,
  ...FOUNDATION,
  ...INTENSIVE,
  ...SUPPORT,
};

export function narrativeFor(narrativeKey: string): CourseNarrative | null {
  return NARRATIVE[narrativeKey] ?? null;
}

export * from "./types";
