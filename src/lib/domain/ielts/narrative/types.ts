/**
 * Narrative content shapes (spec §Domain data — per-course-family narrative). Three distinct shapes;
 * modelled as a discriminated union so each course family renders its own layout. Content data —
 * academic-team-editable; NO logic here.
 */

import type { CourseFamily } from "../courses";

/** Booster 1 → Achiever 3: four blocks incl. a 3-row skill-progression table. */
export interface SkillProgressionRow {
  skill: "Listening/Reading" | "Writing" | "Speaking";
  progression: string; // Progression cốt lõi
  simple: string; // Cách hiểu đơn giản
}
export interface BoosterAchieverNarrative {
  family: "booster-achiever";
  startPoint: string; // Học viên bắt đầu ở đâu?
  bottleneck: string; // Nút thắt thật sự
  howItSolves: string; // Khóa học giải quyết như thế nào?
  skillTable: SkillProgressionRow[]; // 3 rows
  afterCourse: string; // Sau khóa học, học viên thay đổi như thế nào?
}

/** Foundation 1/2: "Bạn sẽ học gì?" (4 areas) + "Mục tiêu khóa học". */
export interface FoundationNarrative {
  family: "foundation";
  learn: {
    listeningReading: string; // Nghe & Đọc
    writingSpeaking: string; // Viết & Nói
    vocabulary: string; // Từ vựng
    grammar: string; // Ngữ pháp
  };
  goal: string; // Mục tiêu khóa học
}

/** Luyện đề Intensive: Đối tượng, Mục tiêu, 3-column (NÓI / VIẾT / CHIẾN LƯỢC THI). */
export interface IntensiveNarrative {
  family: "intensive";
  audience: string; // Đối tượng
  goal: string; // Mục tiêu khóa học
  columns: {
    speaking: string; // NÓI
    writing: string; // VIẾT
    examStrategy: string; // CHIẾN LƯỢC THI
  };
}

/** Pre-S / Grammar Pathway — provisional shape (copy pending academic team). */
export interface SupportNarrative {
  family: "support";
  summary: string;
  provisional: boolean;
}

export type CourseNarrative =
  | BoosterAchieverNarrative
  | FoundationNarrative
  | IntensiveNarrative
  | SupportNarrative;

export type NarrativeByFamily = Record<CourseFamily, unknown>;
