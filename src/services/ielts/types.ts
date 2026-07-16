/**
 * Domain types for the IELTS Roadmap Builder (spec data-model). App camelCase; enum values are the
 * contract. The `StudentRoadmapView` type is the STRUCTURAL barrier that makes it a compile error
 * to leak the internal-only deadline warning into the student PDF (spec SC-006, research D-PDF).
 */

import type { Band } from "@/lib/domain/ielts/bands";
import type { CourseCode, CourseFamily } from "@/lib/domain/ielts/courses";
import type { Audience, Intensity, ExamPurpose } from "@/lib/domain/ielts/labels";
import type { CourseNarrative } from "@/lib/domain/ielts/narrative/types";

export interface RoadmapRequest {
  studentName: string;
  audience: Audience;
  studentEmail: string;
  studentPhone: string | null;
  currentBand: Band;
  targetBand: Band;
  examPurpose: ExamPurpose;
  targetExamDate: string | null; // ISO date
  intensity: Intensity;
  consultantName: string;
  consultantPhone: string | null;
  consultantEmail: string | null;
  centreId: string; // resolved from claims on submit; not trusted from client
  startDate: string | null; // ISO date; defaults to today for completion maths
}

export interface RoadmapCourse {
  code: CourseCode;
  name: string;
  sessions: number;
  sessionsProvisional: boolean;
  family: CourseFamily;
  narrative: CourseNarrative | null;
}

export interface DeadlineWarning {
  kind: "deadline";
  projectedCompletion: string; // ISO date
  targetExamDate: string; // ISO date
  recommend: "intensive" | "revise-target";
}

/** A consultant-only note that must also never reach the student PDF (e.g. "vượt thang chuẩn"). */
export interface ConsultantNoteInternal {
  message: string;
}

export interface Roadmap {
  courses: RoadmapCourse[];
  totalSessions: number;
  totalWeeks: number;
  totalMonths: number;
  projectedCompletion: string | null;
  hasProvisionalSessions: boolean;
  consultantNotes: string | null; // "Ghi chú từ tư vấn viên" (student-visible)
  manualEdited: boolean;
  /** INTERNAL ONLY — never rendered to the student (see StudentRoadmapView). */
  internalWarning: DeadlineWarning | null;
  /** INTERNAL ONLY — consultant-facing note (e.g. target exceeds ladder). */
  consultantNoteInternal: ConsultantNoteInternal | null;
}

/**
 * The type the PDF document accepts. It STRUCTURALLY cannot carry the internal-only fields, so it is
 * a COMPILE ERROR to pass the deadline warning (or the internal consultant note) into the student
 * PDF — SC-006/AC-4.2 enforced at the type level, not by a forgettable runtime check.
 */
export type StudentRoadmapView = Omit<Roadmap, "internalWarning" | "consultantNoteInternal">;

export type DeliveryStatus = "delivered" | "drafted" | "failed";
export interface DeliveryResult {
  status: DeliveryStatus;
  detail?: string;
}

/** Persisted audit log row (tenant-scoped). */
export interface RoadmapRecord {
  id: string;
  centreId: string;
  consultantId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string | null;
  audience: Audience;
  currentBand: Band;
  targetBand: Band;
  courseSequence: CourseCode[];
  manualEdited: boolean;
  sent: boolean;
  generationKey: string;
  createdAt: string;
}
