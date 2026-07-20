"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { bandLabel } from "@/lib/domain/ielts/labels";
import type { SummitStage, Placement } from "@/services/ielts/summit-types";
import { assertNever } from "@/services/ielts/summit-types";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";

type Props = {
  /** Bottom → top (engine order). Rendered with column-reverse so the summit sits on top. */
  stages: SummitStage[];
  studentName: string;
  placement: Placement;
  expandedCode: string | null;
  onOpenStage: (code: SummitStage["code"]) => void;
};

/** Per-state marker treatment: the climb is theirs; below recedes; above stays reachable. */
function stageClasses(state: SummitStage["state"], isExpanded: boolean): string {
  const base =
    "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-[transform,opacity] duration-300 motion-reduce:transition-none";
  switch (state) {
    case "climb":
      return `${base} opacity-100 hover:translate-x-1 ${isExpanded ? "translate-x-1" : ""}`;
    case "below":
      return `${base} opacity-40`;
    case "above":
      return `${base} opacity-60 hover:opacity-90`;
    default:
      return assertNever(state);
  }
}

/**
 * The mountain (Constitution I): the ladder reads bottom → top, always. DOM order is
 * bottom-first; `flex-col-reverse` stacks it visually so the summit is on top. Motion is
 * transform/opacity only, ≤300ms, interruptible (FR-011).
 */
export function Mountain({ stages, studentName, placement, expandedCode, onOpenStage }: Props) {
  const firstClimbIdx = stages.findIndex((s) => s.state === "climb");
  const m = BRAND.mountain;

  return (
    <section
      aria-label="Lộ trình leo núi"
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: `linear-gradient(to bottom, ${m.skyTop}, ${m.skyMid} 40%, ${m.skyBase})`,
      }}
    >
      {/* Summit glow — a state style, not a timed sequence (Constitution VI). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60"
        style={{ background: `radial-gradient(ellipse at top, ${m.summitGlow}, transparent 70%)` }}
      />

      <ol className="relative flex flex-col-reverse gap-1">
        {stages.map((stage, idx) => {
          const isExpanded = expandedCode === stage.code;
          const isStart = idx === firstClimbIdx;
          return (
            <li key={stage.code} style={{ paddingLeft: `${idx * 14}px` }}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => onOpenStage(stage.code)}
                className={stageClasses(stage.state, isExpanded)}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: stage.state === "climb" ? m.pathLit : m.pathDim,
                    boxShadow: stage.state === "climb" ? `0 0 8px ${m.pathLit}` : undefined,
                  }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: stage.state === "climb" ? m.slopeLit : m.slopeDim }}
                >
                  {stage.name}
                </span>
                {stage.sessions !== null && (
                  <span className="text-xs" style={{ color: m.slopeDim }}>
                    {stage.sessions} {SUMMIT_COPY.sessionsUnit}
                  </span>
                )}
                {/* The student's start marker — their mountain, and Mode B is unmistakable. */}
                {isStart && (
                  <StartMarker studentName={studentName} placement={placement} />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Derives from `provisionalTreatmentFor` — THE single decision point (Constitution III). A
 * null treatment renders the measured marker; any non-null treatment renders the provisional
 * one, so a third Placement variant would need a new treatment shape before it could ever
 * reach this component silently as "measured".
 */
function StartMarker({ studentName, placement }: { studentName: string; placement: Placement }) {
  const treatment = provisionalTreatmentFor(placement);
  if (!treatment) {
    const testDate = placement.kind === "measured" ? placement.testDate : null;
    return (
      <span className="ml-auto flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold" style={{ color: BRAND.color.navy }}>
        <span aria-hidden>▲</span>
        {studentName || "…"} · {SUMMIT_COPY.measuredMarker}
        {testDate ? ` (${testDate})` : ""}
      </span>
    );
  }
  return (
    <span
      className="ml-auto flex items-center gap-2 rounded-full border-2 border-dashed px-3 py-1 text-xs font-bold"
      style={{ borderColor: BRAND.color.red, color: "#FFFFFF", backgroundColor: `${BRAND.color.red}CC` }}
    >
      <span aria-hidden>?</span>
      {studentName || "…"} · {treatment.marker}
    </span>
  );
}

/** Band range chip used by the opening summary line above the mountain. */
export function BandRangeLine({ current, target }: { current: string; target: string }) {
  return (
    <p className="text-sm font-medium" style={{ color: BRAND.color.navy }}>
      {bandLabel(current as never)} → {bandLabel(target as never)}
    </p>
  );
}
