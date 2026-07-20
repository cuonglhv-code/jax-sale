/**
 * Pure class-conflict resolver (HR slice #004, US4; data-model §4/§11,
 * contracts/cover-timetable.actions.md). No DB access — the caller fetches `class` rows and the
 * `public_holiday` calendar and passes them in. Reused for two purposes:
 *  1. At submission: resolve the SUBMITTER's affected sessions to require cover nominations.
 *  2. At nomination: resolve the SAME range against the NOMINEE's id — any emitted session is a
 *     hard conflict (FR-020), blocking that nominee.
 *
 * ── AM/PM half-day boundary (research R3's ⚠ VERIFY-AT-IMPLEMENTATION caveat) ──
 * A `morning`/`afternoon` day part must decide which class sessions fall in that half. This is
 * config-driven, NOT hardcoded: callers pass `amPmBoundary` (a `HH:MM[:SS]` string) sourced from
 * `leave_policy_config.am_pm_boundary_time` (added in this slice's migration, default '12:00:00').
 * If omitted, this module defaults to noon so existing callers/tests need not always thread it
 * through — but production call sites (submitRequestCore) MUST read it from policy config, never
 * rely on the local default silently. A session is "morning" when its start_time < boundary, and
 * "afternoon" when its start_time >= boundary — i.e. classification keys off the session's OWN
 * start time relative to the boundary, not whether it overlaps both halves.
 */

import type { LeaveDayPart } from "@/lib/data/types";

const DEFAULT_AM_PM_BOUNDARY = "12:00:00";

/** The minimal shape this module needs from a `class` row — caller maps DB rows into this. */
export interface ConflictClass {
  id: string;
  centreId: string;
  teacherId: string;
  /** ISO weekday 1 (Monday) – 7 (Sunday). */
  weekday: number;
  /** HH:MM or HH:MM:SS. */
  startTime: string;
  /** HH:MM or HH:MM:SS. */
  endTime: string;
  /** ISO date (YYYY-MM-DD) — recurrence window start, inclusive. */
  startDate: string;
  /** ISO date (YYYY-MM-DD) — recurrence window end, inclusive. */
  endDate: string;
  isActive: boolean;
}

export interface AffectedSession {
  classId: string;
  sessionDate: string; // ISO date
  startTime: string;
  endTime: string;
}

export interface ResolveAffectedSessionsInput {
  classes: readonly ConflictClass[];
  teacherId: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  startDate: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  endDate: string;
  dayPart: LeaveDayPart;
  /** ISO date strings (YYYY-MM-DD) excluded from resolution (public_holiday calendar). */
  holidays: readonly string[];
  /** `HH:MM[:SS]` boundary between "morning" and "afternoon" — config-driven; defaults to noon. */
  amPmBoundary?: string;
}

const MS_PER_DAY = 86_400_000;

function toUtcEpoch(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isoWeekday(epoch: number): number {
  const jsDay = new Date(epoch).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return jsDay === 0 ? 7 : jsDay;
}

function toEpochDateString(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

/** Normalize `HH:MM` or `HH:MM:SS` to a comparable `HH:MM:SS` string. */
function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function matchesDayPart(classStartTime: string, dayPart: LeaveDayPart, amPmBoundary: string): boolean {
  if (dayPart === "full") return true;
  const start = normalizeTime(classStartTime);
  const boundary = normalizeTime(amPmBoundary);
  return dayPart === "morning" ? start < boundary : start >= boundary;
}

/**
 * Enumerate every `(class, session_date)` pair in `[startDate, endDate]` where `teacherId` teaches
 * the class, the class is active, the date falls on the class's recurring weekday within its
 * recurrence window, the date is not a holiday, and the day part overlaps the session's half.
 */
export function resolveAffectedSessions(input: ResolveAffectedSessionsInput): AffectedSession[] {
  const startEpoch = toUtcEpoch(input.startDate);
  const endEpoch = toUtcEpoch(input.endDate);
  if (Number.isNaN(startEpoch) || Number.isNaN(endEpoch) || endEpoch < startEpoch) return [];

  const holidaySet = new Set(input.holidays);
  const amPmBoundary = input.amPmBoundary ?? DEFAULT_AM_PM_BOUNDARY;

  const relevantClasses = input.classes.filter((c) => c.isActive && c.teacherId === input.teacherId);
  if (relevantClasses.length === 0) return [];

  const sessions: AffectedSession[] = [];
  for (const klass of relevantClasses) {
    const classStartEpoch = toUtcEpoch(klass.startDate);
    const classEndEpoch = toUtcEpoch(klass.endDate);

    // Only walk the intersection of the leave range and the class's own recurrence window.
    const rangeStart = Math.max(startEpoch, classStartEpoch);
    const rangeEnd = Math.min(endEpoch, classEndEpoch);
    if (rangeEnd < rangeStart) continue;

    for (let epoch = rangeStart; epoch <= rangeEnd; epoch += MS_PER_DAY) {
      if (isoWeekday(epoch) !== klass.weekday) continue;
      const sessionDate = toEpochDateString(epoch);
      if (holidaySet.has(sessionDate)) continue;
      if (!matchesDayPart(klass.startTime, input.dayPart, amPmBoundary)) continue;

      sessions.push({
        classId: klass.id,
        sessionDate,
        startTime: klass.startTime,
        endTime: klass.endTime,
      });
    }
  }

  return sessions;
}
