/**
 * Review-edit application (spec FR-019). Removing/reordering courses must recompute totals (no
 * stale summary — SC-003) and set `manualEdited` so the departs-from-standard-ladder warning
 * shows; the generator itself is never touched (Constitution II).
 */

import { describe, it, expect } from "vitest";
import { generateSummitRoadmap } from "@/services/ielts/summit-engine";
import {
  initialReviewEdits,
  toggleRemoveCourse,
  moveCourse,
  updateConsultantNotes,
  departsFromStandardLadder,
  applyReviewEdits,
} from "@/services/ielts/review-edits";
import type { SummitRequest } from "@/services/ielts/summit-types";
import { PRICES } from "@/lib/domain/ielts/pricing";

function baseRoadmap() {
  const req: SummitRequest = {
    studentName: "Minh Anh",
    currentBand: "4.5",
    targetBand: "7.0",
    placement: { kind: "measured", testDate: null },
  };
  return generateSummitRoadmap(req, "default", "2026-07-17");
}

describe("review edits: no-op is not flagged as manual", () => {
  it("applying default edits keeps the same climb and manualEdited=false", () => {
    const roadmap = baseRoadmap();
    const edits = initialReviewEdits(roadmap);
    const reviewed = applyReviewEdits(roadmap, edits);
    expect(reviewed.stages.map((s) => s.code)).toEqual(["B2", "A1", "A2", "A3", "INT"]);
    expect(reviewed.manualEdited).toBe(false);
    expect(reviewed.totalSessions).toBe(roadmap.totalSessions);
    expect(reviewed.totalPrice.amount).toBe(roadmap.totalPrice.amount);
  });
});

describe("review edits: removal recomputes totals and warns (FR-019)", () => {
  it("removing INT drops its sessions/price and sets manualEdited", () => {
    const roadmap = baseRoadmap();
    const edits = toggleRemoveCourse(initialReviewEdits(roadmap), "INT");
    expect(departsFromStandardLadder(roadmap, edits)).toBe(true);

    const reviewed = applyReviewEdits(roadmap, edits);
    expect(reviewed.stages.map((s) => s.code)).toEqual(["B2", "A1", "A2", "A3"]);
    expect(reviewed.manualEdited).toBe(true);
    expect(reviewed.totalSessions).toBe(roadmap.totalSessions - 16);
    expect(reviewed.totalPrice.amount).toBe(roadmap.totalPrice.amount - PRICES.default.INT!);
  });
});

describe("review edits: reorder warns even with the same course set", () => {
  it("swapping two adjacent courses sets manualEdited and changes stage order", () => {
    const roadmap = baseRoadmap();
    const swapped = moveCourse(initialReviewEdits(roadmap), "A1", -1); // A1 above B2 → swap
    expect(departsFromStandardLadder(roadmap, swapped)).toBe(true);

    const reviewed = applyReviewEdits(roadmap, swapped);
    expect(reviewed.stages.map((s) => s.code)).toEqual(["A1", "B2", "A2", "A3", "INT"]);
    expect(reviewed.manualEdited).toBe(true);
    // Totals unaffected by order alone.
    expect(reviewed.totalSessions).toBe(roadmap.totalSessions);
  });

  it("moving the first course further up (out of range) is a no-op", () => {
    const roadmap = baseRoadmap();
    const edits = moveCourse(initialReviewEdits(roadmap), "B2", -1);
    expect(edits.order).toEqual(initialReviewEdits(roadmap).order);
  });
});

describe("review edits: consultant notes carry into the reviewed roadmap", () => {
  it("sets and clears the free-text note", () => {
    const roadmap = baseRoadmap();
    const withNote = updateConsultantNotes(initialReviewEdits(roadmap), "Học viên rất quyết tâm.");
    expect(applyReviewEdits(roadmap, withNote).consultantNotes).toBe("Học viên rất quyết tâm.");

    const cleared = updateConsultantNotes(withNote, "");
    expect(applyReviewEdits(roadmap, cleared).consultantNotes).toBeNull();
  });
});
