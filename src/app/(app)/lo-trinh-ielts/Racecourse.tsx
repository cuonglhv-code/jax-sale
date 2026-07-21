"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { bandLabel } from "@/lib/domain/ielts/labels";
import type { SummitStage, Placement } from "@/services/ielts/summit-types";
import { assertNever } from "@/services/ielts/summit-types";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";

type Props = {
  /** Ladder order, start → finish (engine order: bottom-of-mountain === start-of-race). */
  stages: SummitStage[];
  studentName: string;
  placement: Placement;
  expandedCode: string | null;
  onOpenStage: (code: SummitStage["code"]) => void;
};

/** Per-state marker treatment: the climb is theirs; below recedes; above stays reachable. */
function checkpointClasses(state: SummitStage["state"], isExpanded: boolean): string {
  const base =
    "group flex flex-col items-center gap-1 transition-[transform,opacity] duration-300 motion-reduce:transition-none";
  switch (state) {
    case "climb":
      return `${base} opacity-100 hover:-translate-y-1 ${isExpanded ? "-translate-y-1" : ""}`;
    case "below":
      return `${base} opacity-40`;
    case "above":
      return `${base} opacity-60 hover:opacity-90`;
    default:
      return assertNever(state);
  }
}

/**
 * The racecourse (Summit redesign): the ladder reads start → finish, left to right, full-bleed
 * hero. Motion is transform/opacity only, ≤300ms, interruptible (Constitution VI, FR-011).
 */
export function Racecourse({ stages, studentName, placement, expandedCode, onOpenStage }: Props) {
  const r = BRAND.racecourse;

  return (
    <section
      aria-label="Đường chạy IELTS"
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: `linear-gradient(to right, ${r.trackStart}, ${r.trackMid} 55%, ${r.trackEnd})`,
      }}
    >
      {/* Finish glow — a state style, not a timed sequence (Constitution VI). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 opacity-60"
        style={{ background: `radial-gradient(ellipse at right, ${r.finishGold}, transparent 70%)` }}
      />

      <ol className="relative flex items-start justify-between gap-1 overflow-x-auto">
        {stages.map((stage, idx) => {
          const isExpanded = expandedCode === stage.code;
          const isStart = idx === stages.findIndex((s) => s.state === "climb");
          return (
            <li key={stage.code} className="flex-1">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => onOpenStage(stage.code)}
                className={checkpointClasses(stage.state, isExpanded)}
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  style={{
                    backgroundColor: stage.state === "climb" ? r.checkpointLit : "rgba(255,255,255,.12)",
                    borderColor: stage.state === "climb" ? "#FFFFFF" : r.checkpointDim,
                    color: "#FFFFFF",
                    boxShadow: stage.state === "climb" ? `0 0 12px ${r.checkpointGlow}` : undefined,
                  }}
                >
                  {stage.name.slice(0, 3)}
                </span>
                <span
                  className="max-w-[80px] text-center text-xs font-semibold"
                  style={{ color: stage.state === "climb" ? "#FFFFFF" : r.checkpointDim }}
                >
                  {stage.name}
                </span>
                {stage.sessions !== null && (
                  <span className="text-[10px]" style={{ color: r.checkpointDim }}>
                    {stage.sessions} {SUMMIT_COPY.sessionsUnit}
                  </span>
                )}
                {isStart && <StartMarker studentName={studentName} placement={placement} />}
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
 * reach this component silently as "measured". Identical logic to the former Mountain.tsx
 * StartMarker — only the layout classes differ (badge sits below the checkpoint, not inline).
 */
function StartMarker({ studentName, placement }: { studentName: string; placement: Placement }) {
  const treatment = provisionalTreatmentFor(placement);
  if (!treatment) {
    const testDate = placement.kind === "measured" ? placement.testDate : null;
    return (
      <span
        className="mt-1 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold"
        style={{ color: BRAND.color.navy }}
      >
        <span aria-hidden>🏁</span>
        {studentName || "…"} · {SUMMIT_COPY.measuredMarker}
        {testDate ? ` (${testDate})` : ""}
      </span>
    );
  }
  return (
    <span
      className="mt-1 flex items-center gap-1 rounded-full border-2 border-dashed px-2 py-0.5 text-[10px] font-bold"
      style={{ borderColor: BRAND.color.red, color: "#FFFFFF", backgroundColor: `${BRAND.color.red}CC` }}
    >
      <span aria-hidden>?</span>
      {studentName || "…"} · {treatment.marker}
    </span>
  );
}

/** Band range chip used by the opening summary line above the racecourse. */
export function BandRangeLine({ current, target }: { current: string; target: string }) {
  return (
    <p className="text-sm font-medium" style={{ color: BRAND.color.navy }}>
      {bandLabel(current as never)} → {bandLabel(target as never)}
    </p>
  );
}
