/**
 * T037 — Secondary content (spec Story 5). Reachability is proven at the reducer level (the
 * true state-machine contract, same approach as summit-ui.test.tsx); the commitments component
 * is proven to render both thresholds verbatim from `thresholds.ts` and hold no threshold text
 * of its own — a grep-style source check, since this file has zero UI logic to diverge from it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  INITIAL_SUMMIT_STATE,
  summitReducer,
  type SummitState,
  type SummitAction,
} from "@/app/(app)/lo-trinh-ielts/summit-state";
import { COMMITMENT_THRESHOLDS } from "@/lib/domain/ielts/thresholds";
import { FAQ } from "@/lib/domain/ielts/faq";

function run(state: SummitState, ...actions: SummitAction[]): SummitState {
  return actions.reduce(summitReducer, state);
}

const ready = run(
  INITIAL_SUMMIT_STATE,
  { type: "setStudentName", name: "Minh Anh" },
  { type: "setCurrentBand", band: "4.5" },
  { type: "setTargetBand", band: "7.0" },
);

describe("secondary content: reachable in one action from any presentation state", () => {
  it("mountain → each tab is one action; back is one action", () => {
    for (const tab of ["ecosystem", "commitments", "faq"] as const) {
      const opened = run(ready, { type: "openSecondary", tab });
      expect(opened.view).toEqual({ kind: "secondary", tab, returnTo: { kind: "mountain" } });
      expect(run(opened, { type: "closeSecondary" }).view).toEqual({ kind: "mountain" });
    }
  });

  it("an expanded stage → secondary → back restores the SAME stage, one action each way", () => {
    const atStage = run(ready, { type: "openStage", code: "A2" });
    const opened = run(atStage, { type: "openSecondary", tab: "faq" });
    expect(run(opened, { type: "closeSecondary" }).view).toEqual({ kind: "stage", code: "A2" });
  });

  it("summary → secondary → back restores summary", () => {
    const atSummary = run(ready, { type: "showSummary" });
    const opened = run(atSummary, { type: "openSecondary", tab: "commitments" });
    expect(run(opened, { type: "closeSecondary" }).view).toEqual({ kind: "summary" });
  });
});

describe("SecondaryContent component: commitments hold no threshold text of their own (SC-005)", () => {
  it("CommitmentsView renders ONLY via COMMITMENT_THRESHOLDS.map — no literal threshold copy in the file", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(here, "../../../src/app/(app)/lo-trinh-ielts/SecondaryContent.tsx"),
      "utf8",
    );
    // The component must import and map the canonical module...
    expect(source).toContain("COMMITMENT_THRESHOLDS");
    expect(source).toMatch(/COMMITMENT_THRESHOLDS\.map/);
    // ...and must not hardcode either threshold's percentages/conditions as literal strings.
    for (const t of COMMITMENT_THRESHOLDS) {
      for (const condition of t.conditions) {
        expect(source).not.toContain(condition);
      }
    }
  });
});

describe("FAQ: objection chips are the index, no scrollable list required (research D-FAQ)", () => {
  it("every entry has a short chip label distinct from the full question", () => {
    for (const f of FAQ) {
      expect(f.chipLabelVi.length).toBeGreaterThan(0);
      expect(f.chipLabelVi.length).toBeLessThan(f.questionVi.length);
    }
  });

  it("stays within a one-glance chip count", () => {
    expect(FAQ.length).toBeLessThanOrEqual(8);
  });
});
