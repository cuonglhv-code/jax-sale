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
}

/** GP placeholder session count — clearly provisional (research D-GP). */
const GP_PROVISIONAL_SESSIONS = 20;

/** The ordered ladder. Rungs run PRE_S…A3; GP is an optional insert; INT is the append. */
export const LADDER: readonly Course[] = [
  { code: "PRE_S", name: "Pre-S (bổ trợ mất gốc)", entryBand: "below A1", outputBand: "~A1", sessions: 16, sessionsProvisional: false, family: "support", role: "rung", narrativeKey: "PRE_S" },
  { code: "IF1", name: "IELTS Foundation 1", entryBand: "~A1", outputBand: "2.5", sessions: 24, sessionsProvisional: false, family: "foundation", role: "rung", narrativeKey: "IF1" },
  { code: "IF2", name: "IELTS Foundation 2", entryBand: "2.5", outputBand: "3.5", sessions: 24, sessionsProvisional: false, family: "foundation", role: "rung", narrativeKey: "IF2" },
  { code: "GP", name: "Grammar Pathway", entryBand: null, outputBand: null, sessions: GP_PROVISIONAL_SESSIONS, sessionsProvisional: true, family: "support", role: "optional-insert", narrativeKey: "GP" },
  { code: "B1", name: "Booster 1", entryBand: "3.5", outputBand: "4.5", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "B1" },
  { code: "B2", name: "Booster 2", entryBand: "4.5", outputBand: "5.5", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "B2" },
  { code: "A1", name: "Achiever 1", entryBand: "5.5", outputBand: "6.0", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "A1" },
  { code: "A2", name: "Achiever 2", entryBand: "6.0", outputBand: "6.5", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "A2" },
  { code: "A3", name: "Achiever 3", entryBand: "6.5", outputBand: "7.0", sessions: 28, sessionsProvisional: false, family: "booster-achiever", role: "rung", narrativeKey: "A3" },
  { code: "INT", name: "Luyện đề Intensive", entryBand: "5.5", outputBand: null, sessions: 16, sessionsProvisional: false, family: "intensive", role: "append", narrativeKey: "INT" },
];

/** The rungs (contiguous, band-ordered) the engine slices across. */
export const RUNGS: readonly Course[] = LADDER.filter((c) => c.role === "rung");

export function courseByCode(code: CourseCode): Course {
  const c = LADDER.find((x) => x.code === code);
  if (!c) throw new Error(`Unknown course code: ${code}`);
  return c;
}
