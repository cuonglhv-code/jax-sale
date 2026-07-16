/**
 * The IELTS roadmap engine (pure ⚙ — spec FR-ENGINE-01..06). Deterministic function of the request
 * + the course-ladder content. No DB/UI/network. The no-skipping rule (contiguous ladder slice) is
 * the crown-jewel invariant, exhaustively tested. See contracts/engine.md + data-model.md.
 */

import {
  LADDER,
  RUNGS,
  courseByCode,
  type Course,
  type CourseCode,
} from "@/lib/domain/ielts/courses";
import {
  bandValue,
  A3_INCLUSION_BAND,
  STANDARD_RATE,
  INTENSIVE_RATE,
  WEEKS_PER_MONTH,
  type Band,
} from "@/lib/domain/ielts/bands";
import { narrativeFor } from "@/lib/domain/ielts/narrative";
import type {
  RoadmapRequest,
  Roadmap,
  RoadmapCourse,
  StudentRoadmapView,
  DeadlineWarning,
} from "./types";

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  const whole = Math.floor(months);
  const dayFraction = Math.round((months - whole) * WEEKS_PER_MONTH * 7);
  d.setMonth(d.getMonth() + whole);
  d.setDate(d.getDate() + dayFraction);
  return d.toISOString().slice(0, 10);
}

function materialize(course: Course): RoadmapCourse {
  return {
    code: course.code,
    name: course.name,
    sessions: course.sessions,
    sessionsProvisional: course.sessionsProvisional,
    family: course.family,
    narrative: narrativeFor(course.narrativeKey),
  };
}

/** Resolve the start rung: audience override (Mất gốc → PRE_S) or first rung still worth taking. */
function startRungIndex(req: RoadmapRequest): number {
  if (req.audience === "MAT_GOC") {
    return RUNGS.findIndex((c) => c.code === "PRE_S");
  }
  const cv = bandValue(req.currentBand);
  // First rung whose output exceeds the current band (the student still has something to gain).
  return RUNGS.findIndex((c) => c.outputBand !== null && bandValue(c.outputBand) > cv);
}

/** Contiguous slice of rungs from start through the first rung whose output meets the target. */
function sliceRungs(req: RoadmapRequest, startIdx: number): Course[] {
  const tv = bandValue(req.targetBand);
  const seq: Course[] = [];
  if (startIdx < 0) return seq; // current at/above ladder top → no rung applies
  for (let i = startIdx; i < RUNGS.length; i++) {
    seq.push(RUNGS[i]);
    const out = RUNGS[i].outputBand;
    if (out !== null && bandValue(out) >= tv) break;
  }
  return seq;
}

export function generateRoadmap(req: RoadmapRequest): Roadmap {
  const tv = bandValue(req.targetBand);
  let consultantNoteInternal: Roadmap["consultantNoteInternal"] = null;

  // 1–2. Start + contiguous slice (NO SKIPPING — FR-ENGINE-01).
  const seq = sliceRungs(req, startRungIndex(req));

  // 3. A3 policy (i): include A3 when target ≥ 6.5 (removable; research D-A3).
  if (tv >= bandValue(A3_INCLUSION_BAND) && !seq.some((c) => c.code === "A3")) {
    const a3 = RUNGS.find((c) => c.code === "A3");
    const lastIdx = seq.length ? RUNGS.indexOf(seq[seq.length - 1]) : -1;
    if (a3 && RUNGS.indexOf(a3) >= lastIdx) seq.push(a3);
  }

  // 4. Audience insert: THCS inserts GP before B1.
  if (req.audience === "THCS") {
    const b1Pos = seq.findIndex((c) => c.code === "B1");
    if (b1Pos >= 0) seq.splice(b1Pos, 0, courseByCode("GP"));
  }

  // 5. Auto-append Intensive (AC-3.1). gap ≤ 0.5 band == ≤ 1 index step.
  const lastRung = [...seq].reverse().find((c) => c.role === "rung");
  const finalOutput = lastRung?.outputBand ?? req.currentBand;
  const gap = tv - bandValue(finalOutput);
  if (tv >= bandValue("5.5") && (req.targetExamDate !== null || gap <= 1)) {
    seq.push(courseByCode("INT"));
  }

  // Edge: nothing applied (entry at/above top) — never empty-and-silent.
  if (seq.length === 0) {
    consultantNoteInternal = {
      message: "Band hiện tại vượt thang chuẩn — đề xuất tư vấn trực tiếp hoặc Luyện đề.",
    };
  }
  // Edge: target beyond A3(+INT) reach.
  if (tv > bandValue("7.0")) {
    consultantNoteInternal = {
      message: "Band mục tiêu vượt mức đảm bảo của thang chuẩn (A3 + Luyện đề).",
    };
  }

  const courses = seq.map(materialize);

  // 6. Timeline maths (AC-3.4/3.5).
  const rate = req.intensity === "TANG_CUONG" ? INTENSIVE_RATE : STANDARD_RATE;
  const totalSessions = courses.reduce((s, c) => s + c.sessions, 0);
  const totalWeeks = totalSessions / rate;
  const totalMonths = totalWeeks / WEEKS_PER_MONTH;
  const start = req.startDate ?? new Date().toISOString().slice(0, 10);
  const projectedCompletion = totalSessions > 0 ? addMonths(start, totalMonths) : null;

  // 7. Deadline feasibility (INTERNAL ONLY — AC-4.1/4.2/4.3).
  let internalWarning: DeadlineWarning | null = null;
  if (req.targetExamDate !== null && projectedCompletion !== null && projectedCompletion > req.targetExamDate) {
    internalWarning = {
      kind: "deadline",
      projectedCompletion,
      targetExamDate: req.targetExamDate,
      recommend: req.intensity === "TIEU_CHUAN" ? "intensive" : "revise-target",
    };
  }

  return {
    courses,
    totalSessions,
    totalWeeks,
    totalMonths,
    projectedCompletion,
    hasProvisionalSessions: courses.some((c) => c.sessionsProvisional),
    consultantNotes: null,
    manualEdited: false,
    internalWarning,
    consultantNoteInternal,
  };
}

/**
 * Drop internal-only fields so the PDF cannot render them (SC-006). The return type has no
 * `internalWarning`/`consultantNoteInternal`, making a leak a compile error at the call site.
 */
export function toStudentView(roadmap: Roadmap): StudentRoadmapView {
  const { internalWarning: _w, consultantNoteInternal: _n, ...view } = roadmap;
  void _w;
  void _n;
  return view;
}

export const _ladderForTests: readonly Course[] = LADDER;
export type { CourseCode };
export type { Band };
