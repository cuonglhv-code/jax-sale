import { describe, it, expect } from "vitest";
import { generateRoadmap, toStudentView } from "@/services/ielts/roadmap-engine";
import type { StudentRoadmapView, Roadmap } from "@/services/ielts/types";
import type { RoadmapRequest } from "@/services/ielts/types";

/**
 * US4 (T021) — the internal-only deadline warning is structurally impossible in the PDF (SC-006,
 * AC-4.2). Enforced at COMPILE TIME: `StudentRoadmapView` (the PDF's input type) has no
 * `internalWarning`/`consultantNoteInternal` field. The type assertions below would break
 * `tsc --noEmit` if that ever changed; the runtime checks confirm `toStudentView` drops them.
 */

// Compile-time barrier: `keyof StudentRoadmapView` must NOT include the internal fields.
// If it did, `Exclude<...>` would differ and this assignment would fail to type-check.
type StudentKeys = keyof StudentRoadmapView;
type LeakedKeys = Extract<StudentKeys, "internalWarning" | "consultantNoteInternal">;
const _noLeak: LeakedKeys extends never ? true : false = true;
// And Roadmap DOES have the field (so the Omit is meaningful):
type RoadmapHasWarning = "internalWarning" extends keyof Roadmap ? true : false;
const _roadmapHasIt: RoadmapHasWarning = true;

function req(overrides: Partial<RoadmapRequest>): RoadmapRequest {
  return {
    studentName: "T", audience: "SINH_VIEN", studentEmail: "t@e.com", studentPhone: null,
    currentBand: "2.5", targetBand: "3.5", examPurpose: "KHAC", targetExamDate: null,
    intensity: "TIEU_CHUAN", consultantName: "C", consultantPhone: null, consultantEmail: null,
    centreId: "x", startDate: "2026-01-01", ...overrides,
  };
}

describe("internal-warning barrier", () => {
  it("type-level barrier holds (StudentRoadmapView omits internal fields)", () => {
    expect(_noLeak).toBe(true);
    expect(_roadmapHasIt).toBe(true);
  });

  it("toStudentView() drops internalWarning and consultantNoteInternal at runtime", () => {
    const roadmap = generateRoadmap(
      req({ currentBand: "2.5", targetBand: "3.5", targetExamDate: "2026-02-01" }),
    );
    const view = toStudentView(roadmap);
    expect("internalWarning" in view).toBe(false);
    expect("consultantNoteInternal" in view).toBe(false);
  });
});
