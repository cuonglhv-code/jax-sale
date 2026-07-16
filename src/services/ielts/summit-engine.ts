/**
 * The Summit engine (spec 005, contracts/summit-engine.md). Pure ⚙ — no DB/UI/network.
 * Delegates the no-skip slice to the shared 002 logic (Constitution II, single source) and
 * applies the summit-boundary rules: FR-003 INT append incl. INT-only climbs, out-of-reach
 * advisory (internal-only), per-centre arithmetic pricing, and the 2.4–3.0/wk duration range.
 */

import { LADDER, RUNGS, courseByCode, type Course } from "@/lib/domain/ielts/courses";
import {
  BANDS,
  bandValue,
  SUMMIT_PACE,
  WEEKS_PER_MONTH,
  type Band,
} from "@/lib/domain/ielts/bands";
import { narrativeFor } from "@/lib/domain/ielts/narrative";
import { PRICES, type CentreKey } from "@/lib/domain/ielts/pricing";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { sliceContiguousRungs, firstUsefulRungIndex } from "./roadmap-engine";
import {
  SummitInputError,
  type SummitRequest,
  type SummitRoadmap,
  type SummitStage,
  type StageState,
} from "./summit-types";

/** The display ladder, bottom → top: every rung then the INT summit row. GP never appears. */
const DISPLAY_LADDER: readonly Course[] = [...RUNGS, courseByCode("INT")];

const INT_ENTRY_IDX = bandValue("5.5");
/** One band index step ≡ 0.5 band in the ≥5.5 region where the INT rule applies. */
const HALF_BAND_STEP = 1;

function assertKnownBand(band: Band, label: string): void {
  if (!BANDS.includes(band)) {
    throw new SummitInputError(`${label} không hợp lệ.`);
  }
}

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}

function toStage(course: Course, state: StageState, priceList: Partial<Record<string, number>>): SummitStage {
  return {
    code: course.code,
    name: course.name,
    family: course.family,
    // D-PRES: Pre-S has no promised duration on the summit path.
    sessions: course.code === "PRE_S" ? null : course.sessions,
    composition: course.composition,
    narrative: narrativeFor(course.narrativeKey),
    price: priceList[course.code] ?? null,
    state,
  };
}

export function generateSummitRoadmap(
  req: SummitRequest,
  centreKey: CentreKey,
  todayIso?: string,
): SummitRoadmap {
  assertKnownBand(req.currentBand, "Band hiện tại");
  assertKnownBand(req.targetBand, "Band mục tiêu");
  const cv = bandValue(req.currentBand);
  const tv = bandValue(req.targetBand);
  if (tv <= cv) throw new SummitInputError(SUMMIT_COPY.invalidTargetPrompt);

  // 1. Contiguous rung slice (Constitution II — shared logic, never reimplemented).
  const rungSlice = sliceContiguousRungs(firstUsefulRungIndex(req.currentBand), req.targetBand);

  // 2. INT append (FR-003 + clarification 2026-07-17):
  //    - normal climbs: target ≥ 5.5 → INT appends (gap is 0 or 0.5 by ladder construction);
  //    - INT-only: no rung applies but current ≥ 5.5 → the climb is [INT] alone;
  //    - out-of-reach targets keep the highest honest climb and gain an internal advisory.
  const climb: Course[] = [...rungSlice];
  const finalRungOut = rungSlice.length
    ? bandValue(rungSlice[rungSlice.length - 1].outputBand as Band)
    : cv;
  const wantsInt = tv >= INT_ENTRY_IDX && finalRungOut >= INT_ENTRY_IDX;
  if (wantsInt) climb.push(courseByCode("INT"));

  if (climb.length === 0) {
    // Below-5.5 empty climbs cannot occur (rungs cover the whole sub-5.5 scale).
    throw new SummitInputError(SUMMIT_COPY.invalidTargetPrompt);
  }

  const reachableIdx = finalRungOut + (wantsInt ? HALF_BAND_STEP : 0);
  const consultantAdvisory = tv > reachableIdx ? SUMMIT_COPY.advisoryBeyondLadder : null;

  // 3. Stage states over the full display ladder.
  const climbCodes = new Set(climb.map((c) => c.code));
  const firstClimbIdx = DISPLAY_LADDER.findIndex((c) => climbCodes.has(c.code));
  const priceList = PRICES[centreKey];
  const stages = DISPLAY_LADDER.map((course, idx) => {
    const state: StageState = climbCodes.has(course.code)
      ? "climb"
      : idx < firstClimbIdx
        ? "below"
        : "above";
    return toStage(course, state, priceList);
  });

  // 4. Totals — sessions (PRE_S contributes none), price (arithmetic sum, FR-016).
  const climbStages = stages.filter((s) => s.state === "climb");
  const totalSessions = climbStages.reduce((sum, s) => sum + (s.sessions ?? 0), 0);
  const priced = climbStages.filter((s) => s.price !== null);
  const totalPrice = {
    amount: priced.reduce((sum, s) => sum + (s.price as number), 0),
    excludesUnpriced: priced.length < climbStages.length,
  };

  // 5. Duration range over the provisional pace band (FR-004 — never a point value).
  const durationWeeks = {
    min: totalSessions / SUMMIT_PACE.maxRate,
    max: totalSessions / SUMMIT_PACE.minRate,
  };
  const durationMonths = {
    min: durationWeeks.min / WEEKS_PER_MONTH,
    max: durationWeeks.max / WEEKS_PER_MONTH,
  };
  const start = todayIso ?? new Date().toISOString().slice(0, 10);
  const projectedFinish =
    totalSessions > 0
      ? { earliest: addWeeks(start, durationWeeks.min), latest: addWeeks(start, durationWeeks.max) }
      : null;

  return {
    request: req,
    centreKey,
    stages,
    totalSessions,
    durationWeeks,
    durationMonths,
    projectedFinish,
    totalPrice,
    hasFlexibleBase: climbCodes.has("PRE_S"),
    consultantNotes: null,
    manualEdited: false,
    consultantAdvisory,
  };
}
