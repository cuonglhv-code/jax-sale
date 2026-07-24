"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { bandLabel } from "@/lib/domain/ielts/labels";
import { CURRENT_BAND_OPTIONS, TARGET_BAND_OPTIONS, type Band } from "@/lib/domain/ielts/bands";
import type { Placement } from "@/services/ielts/summit-types";
import { assertNever } from "@/services/ielts/summit-types";

const inputClass =
  "h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]";

/** Summit current-band options: bands.ts options plus "below A1" for Pre-S entry (T011). */
const SUMMIT_CURRENT_OPTIONS: readonly Band[] = ["below A1", ...CURRENT_BAND_OPTIONS];

type Props = {
  studentName: string;
  currentBand: Band | null;
  targetBand: Band | null;
  placement: Placement;
  /** target ≤ current — refuse to climb, keep every input (edge case). */
  isInvalidPair: boolean;
  onStudentName: (name: string) => void;
  onCurrentBand: (band: Band) => void;
  onTargetBand: (band: Band) => void;
  onPlacement: (placement: Placement) => void;
};

/** The opening: exactly three inputs + the Mode A/B distinction (FR-030, FR-012). */
export function OpeningControls(props: Props) {
  const { placement } = props;
  return (
    <section
      aria-label="Thiết lập lộ trình"
      className="flex flex-wrap items-end gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4"
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
        {SUMMIT_COPY.studentNameLabel}
        <input
          type="text"
          value={props.studentName}
          onChange={(e) => props.onStudentName(e.target.value)}
          className={`${inputClass} w-52`}
        />
      </label>

      <BandSelect
        label={SUMMIT_COPY.currentBandLabel}
        value={props.currentBand}
        options={SUMMIT_CURRENT_OPTIONS}
        onChange={props.onCurrentBand}
      />
      <BandSelect
        label={SUMMIT_COPY.targetBandLabel}
        value={props.targetBand}
        options={TARGET_BAND_OPTIONS}
        onChange={props.onTargetBand}
      />

      {/* Mode A/B — a data distinction, not styling (Constitution III / T019). */}
      <fieldset className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
        <legend className="text-[13px] font-medium text-text">{SUMMIT_COPY.modeLabel}</legend>
        <div className="flex overflow-hidden rounded-[var(--radius-field)] border border-border">
          <ModeButton
            isActive={placement.kind === "measured"}
            onClick={() => props.onPlacement({ kind: "measured", testDate: null })}
          >
            {SUMMIT_COPY.modeMeasured}
          </ModeButton>
          <ModeButton
            isActive={placement.kind === "estimated"}
            onClick={() => props.onPlacement({ kind: "estimated" })}
          >
            {SUMMIT_COPY.modeEstimated}
          </ModeButton>
        </div>
      </fieldset>

      <PlacementDateField placement={placement} onPlacement={props.onPlacement} />

      {props.isInvalidPair && (
        <p role="alert" className="w-full text-sm font-semibold" style={{ color: BRAND.color.red }}>
          {SUMMIT_COPY.invalidTargetPrompt}
        </p>
      )}
    </section>
  );
}

/** Optional test date — Mode A only, never required (clarified 2026-07-17). */
function PlacementDateField({
  placement,
  onPlacement,
}: {
  placement: Placement;
  onPlacement: (p: Placement) => void;
}) {
  switch (placement.kind) {
    case "measured":
      return (
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
          {SUMMIT_COPY.testDateLabel}
          <input
            type="date"
            value={placement.testDate ?? ""}
            onChange={(e) =>
              onPlacement({ kind: "measured", testDate: e.target.value || null })
            }
            className={inputClass}
          />
        </label>
      );
    case "estimated":
      return null;
    default:
      return assertNever(placement);
  }
}

function BandSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Band | null;
  options: readonly Band[];
  onChange: (band: Band) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as Band)}
        className={inputClass}
      >
        <option value="" disabled>
          —
        </option>
        {options.map((band) => (
          <option key={band} value={band}>
            {bandLabel(band)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeButton({
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
      className="h-10 px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none"
      style={
        isActive
          ? { backgroundColor: BRAND.color.navy, color: "#FFFFFF" }
          : { backgroundColor: "#FFFFFF", color: BRAND.color.navy }
      }
    >
      {children}
    </button>
  );
}
