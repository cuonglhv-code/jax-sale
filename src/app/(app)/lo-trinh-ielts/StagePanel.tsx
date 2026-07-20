"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { PRICE_DISPLAY, formatVnd } from "@/lib/domain/ielts/pricing";
import type { CourseNarrative } from "@/lib/domain/ielts/narrative/types";
import type { SummitStage } from "@/services/ielts/summit-types";

type Props = {
  stage: SummitStage;
  onClose: () => void;
};

/** Tier-shaped narrative blocks (FR-009). All copy from content modules — nothing inline. */
function NarrativeBlocks({ narrative }: { narrative: CourseNarrative }) {
  switch (narrative.family) {
    case "booster-achiever":
      return (
        <div className="flex flex-col gap-3">
          <Block label={SUMMIT_COPY.narrative.startPoint}>{narrative.startPoint}</Block>
          {/* The emotional hook — given visual weight (spec: "give it weight"). */}
          <div className="rounded-lg border-l-4 p-3" style={{ borderColor: BRAND.color.red, backgroundColor: `${BRAND.color.red}0D` }}>
            <p className="text-sm font-bold" style={{ color: BRAND.color.red }}>{SUMMIT_COPY.narrative.bottleneck}</p>
            <p className="mt-1 text-base font-medium">{narrative.bottleneck}</p>
          </div>
          <Block label={SUMMIT_COPY.narrative.howItSolves}>{narrative.howItSolves}</Block>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ color: BRAND.color.navy }}>
                <th className="border-b p-2 text-left font-semibold">{SUMMIT_COPY.skillColumnLabel}</th>
                <th className="border-b p-2 text-left font-semibold">{SUMMIT_COPY.progressionCoreLabel}</th>
                <th className="border-b p-2 text-left font-semibold">{SUMMIT_COPY.progressionSimpleLabel}</th>
              </tr>
            </thead>
            <tbody>
              {narrative.skillTable.map((row) => (
                <tr key={row.skill}>
                  <td className="border-b p-2 font-medium">{row.skill}</td>
                  <td className="border-b p-2">{row.progression}</td>
                  <td className="border-b p-2 text-neutral-600">{row.simple}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Block label={SUMMIT_COPY.narrative.afterCourse}>{narrative.afterCourse}</Block>
        </div>
      );
    case "foundation":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold" style={{ color: BRAND.color.navy }}>{SUMMIT_COPY.foundationLearnTitle}</p>
          <Block label={SUMMIT_COPY.narrative.listeningReading}>{narrative.learn.listeningReading}</Block>
          <Block label={SUMMIT_COPY.narrative.writingSpeaking}>{narrative.learn.writingSpeaking}</Block>
          <Block label={SUMMIT_COPY.narrative.vocabulary}>{narrative.learn.vocabulary}</Block>
          <Block label={SUMMIT_COPY.narrative.grammar}>{narrative.learn.grammar}</Block>
          <Block label={SUMMIT_COPY.narrative.goal}>{narrative.goal}</Block>
        </div>
      );
    case "intensive":
      return (
        <div className="flex flex-col gap-3">
          <Block label={SUMMIT_COPY.narrative.audience}>{narrative.audience}</Block>
          <Block label={SUMMIT_COPY.narrative.goal}>{narrative.goal}</Block>
          <div className="grid grid-cols-3 gap-3">
            <Column title={SUMMIT_COPY.narrative.speaking}>{narrative.columns.speaking}</Column>
            <Column title={SUMMIT_COPY.narrative.writing}>{narrative.columns.writing}</Column>
            <Column title={SUMMIT_COPY.narrative.examStrategy}>{narrative.columns.examStrategy}</Column>
          </div>
        </div>
      );
    case "support":
      return <p className="text-sm">{narrative.summary}</p>;
  }
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold" style={{ color: BRAND.color.navy }}>{label}</p>
      <p className="mt-0.5 text-sm">{children}</p>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: `${BRAND.color.navy}33` }}>
      <p className="text-xs font-bold tracking-wide" style={{ color: BRAND.color.red }}>{title}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

/** One stage at a time (FR-008) — the shell guarantees exclusivity; this renders the detail. */
export function StagePanel({ stage, onClose }: Props) {
  return (
    <section
      aria-label={stage.name}
      className="rounded-2xl border bg-white p-5 shadow-sm transition-opacity duration-300 motion-reduce:transition-none"
      style={{ borderColor: `${BRAND.color.navy}22` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: BRAND.color.navy }}>{stage.name}</h2>
          <p className="text-sm text-neutral-600">
            {stage.sessions !== null
              ? `${stage.sessions} ${SUMMIT_COPY.sessionsUnit}`
              : SUMMIT_COPY.flexibleDuration}
            {" · "}
            <span className="font-semibold" style={{ color: BRAND.color.red }}>
              {SUMMIT_COPY.priceLabel}:{" "}
              {stage.price !== null ? formatVnd(stage.price) : PRICE_DISPLAY.unpricedLabelVi}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-neutral-50"
        >
          Đóng
        </button>
      </div>

      {stage.composition.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold" style={{ color: BRAND.color.navy }}>
            {SUMMIT_COPY.compositionTitle}
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {stage.composition.map((line) => (
              <li
                key={line}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${BRAND.color.navy}11`, color: BRAND.color.navy }}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stage.narrative && <NarrativeBlocks narrative={stage.narrative} />}
    </section>
  );
}
