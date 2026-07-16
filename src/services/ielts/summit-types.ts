/**
 * Summit domain types (spec 005 data-model.md). App camelCase; unions are the structural
 * barriers the constitution demands:
 *  - `Placement` (Constitution III): mode is DATA. Renderers switch exhaustively via
 *    `assertNever`; the estimated branch IS the caveat rendering — no bypass prop exists.
 *  - `SummitDocumentView` (Q1 2026-07-17): the document renderer's input type structurally
 *    cannot carry the internal consultant advisory (the 002 StudentRoadmapView pattern).
 */

import type { Band } from "@/lib/domain/ielts/bands";
import type { CourseCode, CourseFamily } from "@/lib/domain/ielts/courses";
import type { CourseNarrative } from "@/lib/domain/ielts/narrative/types";
import type { CentreKey } from "@/lib/domain/ielts/pricing";

/** Mode A (measured, optional test date) | Mode B (estimated — provisional everywhere). */
export type Placement =
  | { kind: "measured"; testDate: string | null }
  | { kind: "estimated" };

/** The opening inputs — exactly FR-030: name, bands, mode. Nothing else. */
export interface SummitRequest {
  studentName: string;
  currentBand: Band;
  targetBand: Band;
  placement: Placement;
}

export type StageState = "below" | "climb" | "above";

export interface SummitStage {
  code: CourseCode;
  name: string;
  family: CourseFamily;
  /** null for PRE_S on the summit path (D-PRES: no promised duration). */
  sessions: number | null;
  /** Per-tier composition lines (FR-001) — stage detail + PDF course cards. */
  composition: readonly string[];
  narrative: CourseNarrative | null;
  /** VND from the centre price list; null renders PRICE_DISPLAY.unpricedLabelVi. */
  price: number | null;
  state: StageState;
}

export interface DurationRange {
  min: number;
  max: number;
}

export interface SummitRoadmap {
  request: SummitRequest;
  centreKey: CentreKey;
  /** The FULL ladder (bottom → top) with per-stage state; the climb is the contiguous slice. */
  stages: SummitStage[];
  totalSessions: number;
  durationWeeks: DurationRange;
  durationMonths: DurationRange;
  projectedFinish: { earliest: string; latest: string } | null;
  totalPrice: { amount: number; excludesUnpriced: boolean };
  /** True when the climb includes PRE_S (flexible duration note — D-PRES). */
  hasFlexibleBase: boolean;
  consultantNotes: string | null;
  manualEdited: boolean;
  /** INTERNAL ONLY — out-of-reach-target advisory; excluded from SummitDocumentView. */
  consultantAdvisory: string | null;
}

/** The ONLY type the document/PDF renderer accepts — advisory is structurally absent. */
export type SummitDocumentView = Omit<SummitRoadmap, "consultantAdvisory">;

/** Drop internal-only fields; leaking the advisory into a document is a compile error. */
export function toDocumentView(roadmap: SummitRoadmap): SummitDocumentView {
  const { consultantAdvisory: _advisory, ...view } = roadmap;
  void _advisory;
  return view;
}

/** Degenerate opening input (target ≤ current) — UI catches, prompts, preserves inputs. */
export class SummitInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummitInputError";
  }
}

/** Exhaustiveness helper — makes a missed Placement/state branch a compile error. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
