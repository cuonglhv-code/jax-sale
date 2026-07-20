/**
 * Pure review-edit application (spec FR-019, contracts/presentation.md §Review & send). The
 * consultant may edit narrative inline, add a note, and remove/reorder courses — but the
 * GENERATOR is never touched; edits apply to the already-generated climb only, and any
 * removal/reorder sets `manualEdited` so the departs-from-standard-ladder warning shows
 * (Constitution II: the engine itself can never produce a skipped level; a manual edit is a
 * distinct, warned, human decision, not a generation path).
 */

import type { SummitRoadmap, SummitStage } from "./summit-types";
import type { CourseCode } from "@/lib/domain/ielts/courses";
import type { CourseNarrative } from "@/lib/domain/ielts/narrative/types";
import { SUMMIT_PACE, WEEKS_PER_MONTH } from "@/lib/domain/ielts/bands";
import { addWeeks } from "./summit-engine";

export interface ReviewEdits {
  /** Ordered climb codes as the consultant wants them sent (default = engine order). */
  order: CourseCode[];
  removed: ReadonlySet<CourseCode>;
  narrativeOverrides: Readonly<Partial<Record<CourseCode, CourseNarrative>>>;
  consultantNotes: string | null;
}

export function initialReviewEdits(roadmap: SummitRoadmap): ReviewEdits {
  return {
    order: roadmap.stages.filter((s) => s.state === "climb").map((s) => s.code),
    removed: new Set(),
    narrativeOverrides: {},
    consultantNotes: roadmap.consultantNotes,
  };
}

export function toggleRemoveCourse(edits: ReviewEdits, code: CourseCode): ReviewEdits {
  const removed = new Set(edits.removed);
  if (removed.has(code)) removed.delete(code);
  else removed.add(code);
  return { ...edits, removed };
}

export function moveCourse(edits: ReviewEdits, code: CourseCode, direction: -1 | 1): ReviewEdits {
  const order = [...edits.order];
  const idx = order.indexOf(code);
  const next = idx + direction;
  if (idx < 0 || next < 0 || next >= order.length) return edits;
  [order[idx], order[next]] = [order[next], order[idx]];
  return { ...edits, order };
}

export function updateNarrative(
  edits: ReviewEdits,
  code: CourseCode,
  narrative: CourseNarrative,
): ReviewEdits {
  return { ...edits, narrativeOverrides: { ...edits.narrativeOverrides, [code]: narrative } };
}

export function updateConsultantNotes(edits: ReviewEdits, notes: string): ReviewEdits {
  return { ...edits, consultantNotes: notes.length > 0 ? notes : null };
}

/** True when the edited climb departs from the engine's contiguous output (FR-019 warning). */
export function departsFromStandardLadder(roadmap: SummitRoadmap, edits: ReviewEdits): boolean {
  const original = roadmap.stages.filter((s) => s.state === "climb").map((s) => s.code);
  const edited = edits.order.filter((c) => !edits.removed.has(c));
  return edited.length !== original.length || edited.some((c, i) => c !== original[i]);
}

/**
 * Apply edits and recompute totals over the EDITED stage set. Review is ALWAYS entered before
 * send (spec Story 3 step 1), so this runs even for a no-op edit — meaning `.stages` on the
 * returned roadmap is ALWAYS exactly the reviewed climb, in the reviewed order, every stage
 * marked `"climb"`. This is deliberately narrower than the generated roadmap's full ladder (no
 * below/above rows — review never renders the mountain): SummitDocument's existing
 * `stages.filter(s => s.state === "climb")` therefore reflects edits with no separate prop, and
 * removing a course cannot leave a stale total (SC-003 — one source for screen and document).
 */
export function applyReviewEdits(roadmap: SummitRoadmap, edits: ReviewEdits): SummitRoadmap {
  const byCode = new Map(roadmap.stages.map((s) => [s.code, s]));
  const editedCodes = edits.order.filter((c) => !edits.removed.has(c));
  const editedStages: SummitStage[] = editedCodes.map((code) => {
    const base = byCode.get(code)!;
    const override = edits.narrativeOverrides[code];
    return { ...base, state: "climb", narrative: override ?? base.narrative };
  });

  const totalSessions = editedStages.reduce((sum, s) => sum + (s.sessions ?? 0), 0);
  const priced = editedStages.filter((s) => s.price !== null);
  const totalPrice = {
    amount: priced.reduce((sum, s) => sum + (s.price as number), 0),
    excludesUnpriced: priced.length < editedStages.length,
  };
  const durationWeeks = {
    min: totalSessions / SUMMIT_PACE.maxRate,
    max: totalSessions / SUMMIT_PACE.minRate,
  };
  const durationMonths = {
    min: durationWeeks.min / WEEKS_PER_MONTH,
    max: durationWeeks.max / WEEKS_PER_MONTH,
  };
  const today = new Date().toISOString().slice(0, 10);
  const projectedFinish =
    totalSessions > 0
      ? { earliest: addWeeks(today, durationWeeks.min), latest: addWeeks(today, durationWeeks.max) }
      : null;

  return {
    ...roadmap,
    stages: editedStages,
    totalSessions,
    durationWeeks,
    durationMonths,
    projectedFinish,
    totalPrice,
    hasFlexibleBase: editedCodes.includes("PRE_S"),
    consultantNotes: edits.consultantNotes,
    manualEdited: departsFromStandardLadder(roadmap, edits),
  };
}
