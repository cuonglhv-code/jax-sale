/**
 * Summit interaction state — a PURE reducer so the presentation contract's rules are unit-
 * testable (contracts/presentation.md): exactly one stage expanded at a time; every state one
 * action from every other; band changes never lose entered data; reset warns on prepared-but-
 * unsent work. No React, no DOM — Summit.tsx consumes this via useReducer.
 */

import type { Band } from "@/lib/domain/ielts/bands";
import type { CourseCode } from "@/lib/domain/ielts/courses";
import type { Placement } from "@/services/ielts/summit-types";

export type SecondaryTab = "ecosystem" | "commitments" | "faq";

export type SummitView =
  | { kind: "mountain" }
  | { kind: "stage"; code: CourseCode }
  | { kind: "summary" }
  | { kind: "secondary"; tab: SecondaryTab; returnTo: SummitView }
  | { kind: "review" };

export interface SummitState {
  studentName: string;
  currentBand: Band | null;
  targetBand: Band | null;
  placement: Placement;
  view: SummitView;
  /** A document was prepared in review and not yet sent — reset must warn (FR-024). */
  hasUnsentWork: boolean;
  isResetPromptOpen: boolean;
  sentAt: string | null;
}

export const INITIAL_SUMMIT_STATE: SummitState = {
  studentName: "",
  currentBand: null,
  targetBand: null,
  placement: { kind: "estimated" },
  view: { kind: "mountain" },
  hasUnsentWork: false,
  isResetPromptOpen: false,
  sentAt: null,
};

export type SummitAction =
  | { type: "setStudentName"; name: string }
  | { type: "setCurrentBand"; band: Band }
  | { type: "setTargetBand"; band: Band }
  | { type: "setPlacement"; placement: Placement }
  | { type: "recordPlacementResult"; testDate: string | null }
  | { type: "openStage"; code: CourseCode }
  | { type: "closeStage" }
  | { type: "showSummary" }
  | { type: "showMountain" }
  | { type: "openSecondary"; tab: SecondaryTab }
  | { type: "closeSecondary" }
  | { type: "enterReview" }
  | { type: "exitReview" }
  | { type: "documentPrepared" }
  | { type: "markSent"; at: string }
  | { type: "requestReset" }
  | { type: "cancelReset" }
  | { type: "confirmReset" };

/** Strip any nested secondary returnTo so returns are always one hop (never a chain). */
function presentationBase(view: SummitView): SummitView {
  return view.kind === "secondary" ? view.returnTo : view;
}

/**
 * View after a band change: an expanded stage collapses cleanly (no stale narrative from the
 * previous slice — spec edge case); the summary stays put and recomputes.
 */
function viewAfterBandChange(view: SummitView): SummitView {
  const base = presentationBase(view);
  return base.kind === "summary" ? base : { kind: "mountain" };
}

export function summitReducer(state: SummitState, action: SummitAction): SummitState {
  switch (action.type) {
    case "setStudentName":
      return { ...state, studentName: action.name };
    case "setCurrentBand":
      // Band changes re-render the climb; every other input is preserved (FR-010).
      return { ...state, currentBand: action.band, view: viewAfterBandChange(state.view) };
    case "setTargetBand":
      return { ...state, targetBand: action.band, view: viewAfterBandChange(state.view) };
    case "setPlacement":
      return { ...state, placement: action.placement };
    case "recordPlacementResult":
      // Mode B → Mode A flips everywhere at once (Constitution III).
      return { ...state, placement: { kind: "measured", testDate: action.testDate } };
    case "openStage":
      // Exactly one stage at a time (FR-008): opening any stage replaces the expanded one.
      return { ...state, view: { kind: "stage", code: action.code } };
    case "closeStage":
      return { ...state, view: { kind: "mountain" } };
    case "showSummary":
      return { ...state, view: { kind: "summary" } };
    case "showMountain":
      return { ...state, view: { kind: "mountain" } };
    case "openSecondary":
      return {
        ...state,
        view: { kind: "secondary", tab: action.tab, returnTo: presentationBase(state.view) },
      };
    case "closeSecondary":
      return state.view.kind === "secondary" ? { ...state, view: state.view.returnTo } : state;
    case "enterReview":
      return { ...state, view: { kind: "review" } };
    case "exitReview":
      return { ...state, view: presentationBase({ kind: "mountain" }) };
    case "documentPrepared":
      return { ...state, hasUnsentWork: true };
    case "markSent":
      return { ...state, hasUnsentWork: false, sentAt: action.at };
    case "requestReset":
      // Prepared-but-unsent work warns before discarding (FR-024); otherwise reset directly.
      return state.hasUnsentWork
        ? { ...state, isResetPromptOpen: true }
        : { ...INITIAL_SUMMIT_STATE };
    case "cancelReset":
      return { ...state, isResetPromptOpen: false };
    case "confirmReset":
      return { ...INITIAL_SUMMIT_STATE };
    default:
      return state;
  }
}
