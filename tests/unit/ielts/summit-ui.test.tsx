/**
 * T016 — Summit interaction contract (contracts/presentation.md). The rules live in the pure
 * reducer (summit-state.ts) so they are testable deterministically: exactly one stage at a
 * time, one-action reachability, band changes preserve inputs, reset warns on unsent work.
 * Bottom-to-top stage ordering is covered by the engine suite (stages array order).
 */

import { describe, it, expect } from "vitest";
import {
  INITIAL_SUMMIT_STATE,
  summitReducer,
  type SummitState,
  type SummitAction,
} from "@/app/(app)/lo-trinh-ielts/summit-state";

function run(state: SummitState, ...actions: SummitAction[]): SummitState {
  return actions.reduce(summitReducer, state);
}

const ready = run(
  INITIAL_SUMMIT_STATE,
  { type: "setStudentName", name: "Minh Anh" },
  { type: "setCurrentBand", band: "4.5" },
  { type: "setTargetBand", band: "7.0" },
);

describe("summit state: one stage at a time (FR-008)", () => {
  it("opening a second stage replaces the first — never two expanded", () => {
    const one = run(ready, { type: "openStage", code: "B2" });
    expect(one.view).toEqual({ kind: "stage", code: "B2" });
    const two = run(one, { type: "openStage", code: "A1" });
    expect(two.view).toEqual({ kind: "stage", code: "A1" });
  });
});

describe("summit state: one-action reachability (FR-010 / SC-008)", () => {
  it("summary, mountain, any stage, and secondary are each one action from a stage view", () => {
    const atStage = run(ready, { type: "openStage", code: "A2" });
    expect(run(atStage, { type: "showSummary" }).view.kind).toBe("summary");
    expect(run(atStage, { type: "closeStage" }).view.kind).toBe("mountain");
    expect(run(atStage, { type: "openStage", code: "A3" }).view).toEqual({ kind: "stage", code: "A3" });
    expect(run(atStage, { type: "openSecondary", tab: "faq" }).view.kind).toBe("secondary");
  });

  it("closing secondary returns to the prior presentation state in one action", () => {
    const atStage = run(ready, { type: "openStage", code: "A2" });
    const inFaq = run(atStage, { type: "openSecondary", tab: "faq" });
    expect(run(inFaq, { type: "closeSecondary" }).view).toEqual({ kind: "stage", code: "A2" });
  });

  it("secondary → secondary never chains returnTo (always one hop back)", () => {
    const s = run(
      ready,
      { type: "showSummary" },
      { type: "openSecondary", tab: "faq" },
      { type: "openSecondary", tab: "commitments" },
      { type: "closeSecondary" },
    );
    expect(s.view).toEqual({ kind: "summary" });
  });
});

describe("summit state: band changes never lose entered data (FR-010)", () => {
  it("changing the target mid-conversation keeps the name and current band", () => {
    const atStage = run(ready, { type: "openStage", code: "A2" });
    const changed = run(atStage, { type: "setTargetBand", band: "6.0" });
    expect(changed.studentName).toBe("Minh Anh");
    expect(changed.currentBand).toBe("4.5");
    expect(changed.targetBand).toBe("6.0");
    // Expanded stage collapses cleanly — no stale narrative from the previous slice.
    expect(changed.view.kind).toBe("mountain");
  });
});

describe("summit state: mode transitions (Constitution III)", () => {
  it("recording a placement result flips estimated → measured everywhere at once", () => {
    const estimated = run(ready, { type: "setPlacement", placement: { kind: "estimated" } });
    const measured = run(estimated, { type: "recordPlacementResult", testDate: "2026-07-15" });
    expect(measured.placement).toEqual({ kind: "measured", testDate: "2026-07-15" });
  });
});

describe("summit state: reset (FR-024)", () => {
  it("reset with no prepared work clears to blank immediately (one action)", () => {
    const s = run(ready, { type: "requestReset" });
    expect(s).toEqual(INITIAL_SUMMIT_STATE);
  });

  it("reset with prepared-but-unsent work warns first; confirm clears all PII", () => {
    const prepared = run(ready, { type: "enterReview" }, { type: "documentPrepared" });
    const prompted = run(prepared, { type: "requestReset" });
    expect(prompted.isResetPromptOpen).toBe(true);
    expect(prompted.studentName).toBe("Minh Anh"); // nothing lost yet
    const cancelled = run(prompted, { type: "cancelReset" });
    expect(cancelled.isResetPromptOpen).toBe(false);
    expect(cancelled.studentName).toBe("Minh Anh");
    const cleared = run(prompted, { type: "confirmReset" });
    expect(cleared).toEqual(INITIAL_SUMMIT_STATE);
  });

  it("after a successful send, reset no longer warns", () => {
    const sent = run(
      ready,
      { type: "enterReview" },
      { type: "documentPrepared" },
      { type: "markSent", at: "2026-07-17" },
    );
    expect(run(sent, { type: "requestReset" })).toEqual(INITIAL_SUMMIT_STATE);
  });
});

describe("summitReducer — discount", () => {
  it("starts with no discount", () => {
    expect(INITIAL_SUMMIT_STATE.discount).toBeNull();
  });

  it("setDiscount stores the discount input", () => {
    const next = summitReducer(INITIAL_SUMMIT_STATE, {
      type: "setDiscount",
      discount: { type: "percent", value: 10 },
    });
    expect(next.discount).toEqual({ type: "percent", value: 10 });
  });

  it("setDiscount(null) clears an existing discount", () => {
    const withDiscount = summitReducer(INITIAL_SUMMIT_STATE, {
      type: "setDiscount",
      discount: { type: "percent", value: 10 },
    });
    const cleared = summitReducer(withDiscount, { type: "setDiscount", discount: null });
    expect(cleared.discount).toBeNull();
  });

  it("confirmReset clears the discount along with everything else", () => {
    const withDiscount = summitReducer(INITIAL_SUMMIT_STATE, {
      type: "setDiscount",
      discount: { type: "amount", value: 500_000 },
    });
    const reset = summitReducer(withDiscount, { type: "confirmReset" });
    expect(reset.discount).toBeNull();
  });
});
