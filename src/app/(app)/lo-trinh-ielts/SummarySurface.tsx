"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { formatVnd } from "@/lib/domain/ielts/pricing";
import { applyDiscount, type DiscountInput } from "@/lib/domain/ielts/pricing-discount";
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

const DISCOUNT_PERCENT_PRESETS = [0, 5, 10, 15] as const;

type Props = {
  roadmap: SummitRoadmap;
  discount: DiscountInput | null;
  onDiscountChange: (discount: DiscountInput | null) => void;
};

/** The climb's summary: buổi, duration range, projected finish, discounted total (FR-007). */
export function SummarySurface({ roadmap, discount, onDiscountChange }: Props) {
  // Same single decision point as the racecourse marker and PDF cover (Constitution III).
  const treatment = provisionalTreatmentFor(roadmap.request.placement);
  const prefix = treatment ? `${treatment.estimatePrefix} ` : "";
  const breakdown = applyDiscount(roadmap.totalPrice.amount, discount);

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
          {formatVnd(breakdown.net)}
        </Item>
      </dl>
      {roadmap.hasFlexibleBase && (
        <p className="mt-3 text-xs text-neutral-600">{SUMMIT_COPY.preSFlexibleNote}</p>
      )}
      {roadmap.totalPrice.excludesUnpriced && (
        <p className="mt-1 text-xs text-neutral-600">{SUMMIT_COPY.excludesUnpricedNote}</p>
      )}

      <DiscountControl discount={discount} onDiscountChange={onDiscountChange} breakdown={breakdown} />
    </section>
  );
}

function DiscountControl({
  discount,
  onDiscountChange,
  breakdown,
}: {
  discount: DiscountInput | null;
  onDiscountChange: (discount: DiscountInput | null) => void;
  breakdown: ReturnType<typeof applyDiscount>;
}) {
  const activePercent = discount?.type === "percent" ? discount.value : null;

  return (
    <div className="mt-4 rounded-xl border p-3" style={{ borderColor: `${BRAND.color.navy}22` }}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: BRAND.color.navy }}>
        {SUMMIT_COPY.discount.label}
      </p>
      <div className="flex flex-wrap gap-2">
        {DISCOUNT_PERCENT_PRESETS.map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => onDiscountChange(pct === 0 ? null : { type: "percent", value: pct })}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={
              activePercent === pct || (pct === 0 && !discount)
                ? { backgroundColor: BRAND.color.navy, color: BRAND.color.paper, borderColor: BRAND.color.navy }
                : { color: BRAND.color.navy, borderColor: `${BRAND.color.navy}55` }
            }
          >
            {pct}%
          </button>
        ))}
        <CustomDiscountInput discount={discount} onDiscountChange={onDiscountChange} />
      </div>
      {breakdown.hasDiscount && (
        <p className="mt-2 text-xs text-neutral-600">
          {SUMMIT_COPY.discount.grossLabel}: <s>{formatVnd(breakdown.gross)}</s> ·{" "}
          {SUMMIT_COPY.discount.offLabel} {formatVnd(breakdown.off)} ·{" "}
          {SUMMIT_COPY.discount.netLabel}: {formatVnd(breakdown.net)}
        </p>
      )}
    </div>
  );
}

function CustomDiscountInput({
  discount,
  onDiscountChange,
}: {
  discount: DiscountInput | null;
  onDiscountChange: (discount: DiscountInput | null) => void;
}) {
  const unit = discount?.type === "amount" ? "amount" : "percent";

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        placeholder={SUMMIT_COPY.discount.customPlaceholder}
        className="w-20 rounded-md border px-2 py-1 text-xs"
        onChange={(e) => {
          const value = Number(e.target.value);
          if (!e.target.value || Number.isNaN(value)) {
            onDiscountChange(null);
            return;
          }
          onDiscountChange({ type: unit, value });
        }}
      />
      <select
        value={unit}
        onChange={(e) => onDiscountChange(discount ? { type: e.target.value as "percent" | "amount", value: discount.value } : null)}
        className="rounded-md border px-1 py-1 text-xs"
      >
        <option value="percent">{SUMMIT_COPY.discount.unitPercent}</option>
        <option value="amount">{SUMMIT_COPY.discount.unitAmount}</option>
      </select>
    </div>
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
