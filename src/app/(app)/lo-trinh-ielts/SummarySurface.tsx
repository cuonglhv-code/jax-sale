"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { formatVnd } from "@/lib/domain/ielts/pricing";
import type { SummitRoadmap } from "@/services/ielts/summit-types";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";

/** "43–53 tuần (≈10–12 tháng)" — always a range, never false precision (FR-004). */
export function formatDurationRange(roadmap: SummitRoadmap): string {
  const w = roadmap.durationWeeks;
  const m = roadmap.durationMonths;
  return `${Math.round(w.min)}–${Math.round(w.max)} ${SUMMIT_COPY.weeksUnit} (≈${Math.round(m.min)}–${Math.round(m.max)} ${SUMMIT_COPY.monthsUnit})`;
}

function formatFinishWindow(roadmap: SummitRoadmap): string {
  if (!roadmap.projectedFinish) return "—";
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("vi-VN", { month: "numeric", year: "numeric" });
  return `${fmt(roadmap.projectedFinish.earliest)} – ${fmt(roadmap.projectedFinish.latest)}`;
}

type Props = {
  roadmap: SummitRoadmap;
};

/** The climb's summary: buổi, duration range, projected finish, arithmetic total (FR-007). */
export function SummarySurface({ roadmap }: Props) {
  // Same single decision point as the mountain marker and PDF cover (Constitution III).
  const treatment = provisionalTreatmentFor(roadmap.request.placement);
  const prefix = treatment ? `${treatment.estimatePrefix} ` : "";
  return (
    <section
      aria-label={SUMMIT_COPY.summaryTitle}
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: `${BRAND.color.navy}22` }}
    >
      <h2 className="mb-3 text-lg font-bold" style={{ color: BRAND.color.navy }}>
        {SUMMIT_COPY.summaryTitle}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Item label={SUMMIT_COPY.totalSessionsLabel}>
          {roadmap.totalSessions} {SUMMIT_COPY.sessionsUnit}
        </Item>
        <Item label={SUMMIT_COPY.durationLabel}>
          {prefix}
          {formatDurationRange(roadmap)}
        </Item>
        <Item label={SUMMIT_COPY.projectedFinishLabel}>
          {prefix}
          {formatFinishWindow(roadmap)}
        </Item>
        <Item label={SUMMIT_COPY.totalPriceLabel} emphasized>
          {prefix}
          {formatVnd(roadmap.totalPrice.amount)}
        </Item>
      </dl>
      {roadmap.hasFlexibleBase && (
        <p className="mt-3 text-xs text-neutral-600">{SUMMIT_COPY.preSFlexibleNote}</p>
      )}
      {roadmap.totalPrice.excludesUnpriced && (
        <p className="mt-1 text-xs text-neutral-600">{SUMMIT_COPY.excludesUnpricedNote}</p>
      )}
    </section>
  );
}

function Item({
  label,
  emphasized,
  children,
}: {
  label: string;
  emphasized?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd
        className={emphasized ? "mt-0.5 text-xl font-extrabold" : "mt-0.5 text-base font-semibold"}
        style={emphasized ? { color: BRAND.color.red } : undefined}
      >
        {children}
      </dd>
    </div>
  );
}
