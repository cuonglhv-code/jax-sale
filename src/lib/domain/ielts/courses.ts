/**
 * The official IELTS 2026 course ladder (content data — spec §Domain data). Academic-team-editable;
 * NO engine logic here. Session counts and the GP provisional flag are single-source constants.
 * ⚠ GP session count is a placeholder pending academic confirmation (research D-GP).
 */

import type { Band } from "./bands";

export const COURSE_CODES = [
  "PRE_S",
  "IF1",
  "IF2",
  "GP",
  "B1",
  "B2",
  "A1",
  "A2",
  "A3",
  "INT",
] as const;
export type CourseCode = (typeof COURSE_CODES)[number];

export type CourseFamily = "support" | "foundation" | "booster-achiever" | "intensive";
export type CourseRole = "rung" | "optional-insert" | "append";

export interface Course {
  code: CourseCode;
  name: string;
  entryBand: Band | null; // null for GP/INT (not slotted by band)
  outputBand: Band | null; // null for GP; INT is "+0.5 overall" (special)
  sessions: number;
  sessionsProvisional: boolean; // GP until confirmed
  family: CourseFamily;
  role: CourseRole;
  narrativeKey: string; // key into the narrative content store
  /** Per-tier session composition lines (005 FR-001, clarified 2026-07-17) — rendered in the
   *  summit stage detail and on PDF course cards. Content data; empty when not defined. */
  composition: readonly string[];
}

/** GP placeholder session count — clearly provisional (research D-GP). */
const GP_PROVISIONAL_SESSIONS = 20;

/** Per-tier session composition lines (005 FR-001) — content data, academic-team-editable. */
const FOUNDATION_COMPOSITION = ["20 buổi chính", "2 buổi ôn tập", "Midterm", "Final"] as const;
const BOOSTER_COMPOSITION = ["24 buổi chính", "2 buổi ôn tập", "Midterm", "Final"] as const;
const ACHIEVER_COMPOSITION = ["24 buổi chính", "2 buổi Mock test", "Midterm (đề thật)", "Final (đề thật)"] as const;
const INTENSIVE_COMPOSITION = ["16 buổi luyện đề chuyên sâu"] as const;

/** The ordered ladder. Rungs run PRE_S…A3; GP is an optional insert; INT is the append. */
export const LADDER: readonly Course[] = [
  { code: "PRE_S", name: "Pre-S (bổ trợ mất gốc)", entryBand: "below A1", outputBand: "~A1", sessions: 16, sessionsProvisional: false, family: "support", role: "rung", narrativeKey: "PRE_S", composition: [] },
  { code: "IF1", name: "IELTS Foundation 1", entryBand: "~A1", outputBand: "2.5", sessions: 24, sessionsProvisional: false, family: "foundation", role: "rung", narrativeKey: "IF1", composition: FOUNDATION_COMPOSITION },
  { code: "IF2", name: "IELTS Foundation 2", entryBand: "2.5", outputBand: "3.5", sessions: 24, sessionsProvisional: false, family: "foundation", role: "rung", narrativeKey: "IF2", composition: FOUNDATION_COMPOSITION },
  { code: "GP", name: "Grammar Pathway", entryBand: null, outputBand: null, sessions: GP_PROVISIONAL_SESSIONS, sessionsProvisional: true, family: "support", role: "optional-insert", narrativeKey: "GP", composition: [] },
  { code: "B1", name: "Booster 1", entryBand: "3.5", outputBand: "4.5", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "B1", composition: BOOSTER_COMPOSITION },
  { code: "B2", name: "Booster 2", entryBand: "4.5", outputBand: "5.5", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "B2", composition: BOOSTER_COMPOSITION },
  { code: "A1", name: "Achiever 1", entryBand: "5.5", outputBand: "6.0", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "A1", composition: ACHIEVER_COMPOSITION },
  { code: "A2", name: "Achiever 2", entryBand: "6.0", outputBand: "6.5", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "A2", composition: ACHIEVER_COMPOSITION },
  { code: "A3", name: "Achiever 3", entryBand: "6.5", outputBand: "7.0", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "A3", composition: ACHIEVER_COMPOSITION },
  { code: "INT", name: "Luyện đề Intensive", entryBand: "5.5", outputBand: null, sessions: 16, sessionsProvisional: false, family: "intensive", role: "append", narrativeKey: "INT", composition: INTENSIVE_COMPOSITION },
];

/** The rungs (contiguous, band-ordered) the engine slices across. */
export const RUNGS: readonly Course[] = LADDER.filter((c) => c.role === "rung");

export function courseByCode(code: CourseCode): Course {
  const c = LADDER.find((x) => x.code === code);
  if (!c) throw new Error(`Unknown course code: ${code}`);
  return c;
}
