"use client";

import { useMemo, useReducer } from "react";
import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { centreKeyForName } from "@/lib/domain/ielts/pricing";
import { generateSummitRoadmap } from "@/services/ielts/summit-engine";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";
import {
  SummitInputError,
  type SummitRoadmap,
  type SummitRequest,
} from "@/services/ielts/summit-types";
import { INITIAL_SUMMIT_STATE, summitReducer } from "./summit-state";
import { OpeningControls } from "./OpeningControls";
import { Mountain } from "./Mountain";
import { StagePanel } from "./StagePanel";
import { SummarySurface } from "./SummarySurface";
import { ReviewSend } from "./ReviewSend";
import { ProofSummit } from "./ProofSummit";
import { SecondaryContent } from "./SecondaryContent";

export type ConsultantInfo = { name: string; email: string; centreName: string };

/**
 * The Summit shell (contracts/presentation.md): one continuous surface — mountain, stage
 * detail, summary — every state one action from every other (FR-010). No autoplay, no sound,
 * nothing gates the consultant's next utterance (Constitution VI).
 */
export function Summit({ consultant }: { consultant: ConsultantInfo }) {
  const [state, dispatch] = useReducer(summitReducer, INITIAL_SUMMIT_STATE);
  const centreKey = centreKeyForName(consultant.centreName);

  // Pure derivation — the climb re-renders instantly on any band/mode change (FR-010).
  const { roadmap, isInvalidPair } = useMemo((): {
    roadmap: SummitRoadmap | null;
    isInvalidPair: boolean;
  } => {
    if (!state.currentBand || !state.targetBand) return { roadmap: null, isInvalidPair: false };
    const request: SummitRequest = {
      studentName: state.studentName,
      currentBand: state.currentBand,
      targetBand: state.targetBand,
      placement: state.placement,
    };
    try {
      return { roadmap: generateSummitRoadmap(request, centreKey), isInvalidPair: false };
    } catch (err) {
      if (err instanceof SummitInputError) return { roadmap: null, isInvalidPair: true };
      throw err;
    }
  }, [state.studentName, state.currentBand, state.targetBand, state.placement, centreKey]);

  const expandedCode = state.view.kind === "stage" ? state.view.code : null;
  const expandedStage = roadmap?.stages.find((s) => s.code === expandedCode) ?? null;
  // Same single decision point as the mountain marker and PDF cover (Constitution III).
  const treatment = provisionalTreatmentFor(state.placement);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold" style={{ color: BRAND.color.navy }}>
          Jaxtina IELTS Summit
        </h1>
        <button
          type="button"
          onClick={() => dispatch({ type: "requestReset" })}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          {SUMMIT_COPY.resetButton}
        </button>
      </header>

      {state.isResetPromptOpen && (
        <div
          role="alertdialog"
          className="flex items-center justify-between gap-4 rounded-xl border-2 p-4"
          style={{ borderColor: BRAND.color.red }}
        >
          <p className="text-sm font-semibold">{SUMMIT_COPY.resetUnsentWarning}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "confirmReset" })}
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-white"
              style={{ backgroundColor: BRAND.color.red }}
            >
              {SUMMIT_COPY.resetConfirm}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "cancelReset" })}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium"
            >
              {SUMMIT_COPY.resetCancel}
            </button>
          </div>
        </div>
      )}

      <OpeningControls
        studentName={state.studentName}
        currentBand={state.currentBand}
        targetBand={state.targetBand}
        placement={state.placement}
        isInvalidPair={isInvalidPair}
        onStudentName={(name) => dispatch({ type: "setStudentName", name })}
        onCurrentBand={(band) => dispatch({ type: "setCurrentBand", band })}
        onTargetBand={(band) => dispatch({ type: "setTargetBand", band })}
        onPlacement={(placement) => dispatch({ type: "setPlacement", placement })}
      />

      {/* Mode B caveat — visible without interaction, with the placement-test CTA (FR-013). */}
      {roadmap && treatment && (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border-2 border-dashed px-4 py-3"
          style={{ borderColor: BRAND.color.red, backgroundColor: `${BRAND.color.red}0D` }}
        >
          <p className="text-sm font-bold" style={{ color: BRAND.color.red }}>
            {treatment.caveat}
          </p>
          <span
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: BRAND.color.red }}
          >
            {treatment.cta}
          </span>
        </div>
      )}

      {/* Internal-only advisory — consultant-facing, never in any document (Q1 2026-07-17). */}
      {roadmap?.consultantAdvisory && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
          {roadmap.consultantAdvisory}
        </p>
      )}

      {roadmap && state.view.kind === "review" && (
        <ReviewSend
          roadmap={roadmap}
          consultant={consultant}
          onBack={() => dispatch({ type: "exitReview" })}
          onDocumentPrepared={() => dispatch({ type: "documentPrepared" })}
          onSent={() => dispatch({ type: "markSent", at: new Date().toISOString() })}
        />
      )}

      {roadmap && state.view.kind !== "review" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Mountain
            stages={roadmap.stages}
            studentName={state.studentName}
            placement={state.placement}
            expandedCode={expandedCode}
            onOpenStage={(code) => dispatch({ type: "openStage", code })}
          />
          <div className="flex flex-col gap-4">
            {/* Persistent rail — every state one action away (FR-010). */}
            <nav aria-label="Điều hướng" className="flex flex-wrap gap-2">
              <RailButton
                isActive={state.view.kind === "summary"}
                onClick={() => dispatch({ type: "showSummary" })}
              >
                {SUMMIT_COPY.summaryTitle}
              </RailButton>
              <RailButton
                isActive={state.view.kind === "mountain"}
                onClick={() => dispatch({ type: "showMountain" })}
              >
                {SUMMIT_COPY.railBack}
              </RailButton>
              <RailButton isActive={false} onClick={() => dispatch({ type: "enterReview" })}>
                {SUMMIT_COPY.railReview}
              </RailButton>
              <RailButton
                isActive={state.view.kind === "secondary" && state.view.tab === "ecosystem"}
                onClick={() => dispatch({ type: "openSecondary", tab: "ecosystem" })}
              >
                {SUMMIT_COPY.railEcosystem}
              </RailButton>
              <RailButton
                isActive={state.view.kind === "secondary" && state.view.tab === "commitments"}
                onClick={() => dispatch({ type: "openSecondary", tab: "commitments" })}
              >
                {SUMMIT_COPY.railCommitments}
              </RailButton>
              <RailButton
                isActive={state.view.kind === "secondary" && state.view.tab === "faq"}
                onClick={() => dispatch({ type: "openSecondary", tab: "faq" })}
              >
                {SUMMIT_COPY.railFaq}
              </RailButton>
            </nav>

            {expandedStage && (
              <StagePanel stage={expandedStage} onClose={() => dispatch({ type: "closeStage" })} />
            )}
            {state.view.kind === "summary" && <SummarySurface roadmap={roadmap} />}
            {state.view.kind === "secondary" && (
              <SecondaryContent tab={state.view.tab} onBack={() => dispatch({ type: "closeSecondary" })} />
            )}

            {/* The summit is what the climb earns — matched proof, always available (Story 4). */}
            {state.currentBand && state.targetBand && (
              <ProofSummit currentBand={state.currentBand} targetBand={state.targetBand} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RailButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none"
      style={
        isActive
          ? { backgroundColor: BRAND.color.navy, color: "#FFFFFF", borderColor: BRAND.color.navy }
          : { color: BRAND.color.navy, borderColor: `${BRAND.color.navy}55` }
      }
    >
      {children}
    </button>
  );
}
