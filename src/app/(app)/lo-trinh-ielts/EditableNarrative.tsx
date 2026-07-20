"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import type { CourseNarrative } from "@/lib/domain/ielts/narrative/types";

type Props = {
  narrative: CourseNarrative;
  onChange: (narrative: CourseNarrative) => void;
};

const fieldClass =
  "w-full resize-none rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2";

/** Every narrative block is editable inline (FR-019) — one field per tier-shaped text value. */
export function EditableNarrative({ narrative, onChange }: Props) {
  switch (narrative.family) {
    case "booster-achiever":
      return (
        <div className="flex flex-col gap-3">
          <EditField
            label={SUMMIT_COPY.narrative.startPoint}
            value={narrative.startPoint}
            onChange={(v) => onChange({ ...narrative, startPoint: v })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.bottleneck}
            emphasized
            value={narrative.bottleneck}
            onChange={(v) => onChange({ ...narrative, bottleneck: v })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.howItSolves}
            value={narrative.howItSolves}
            onChange={(v) => onChange({ ...narrative, howItSolves: v })}
          />
          {narrative.skillTable.map((row, i) => (
            <div key={row.skill} className="grid grid-cols-2 gap-2">
              <EditField
                label={`${row.skill} — ${SUMMIT_COPY.progressionCoreLabel}`}
                value={row.progression}
                onChange={(v) => {
                  const skillTable = narrative.skillTable.map((r, j) =>
                    j === i ? { ...r, progression: v } : r,
                  );
                  onChange({ ...narrative, skillTable });
                }}
              />
              <EditField
                label={SUMMIT_COPY.progressionSimpleLabel}
                value={row.simple}
                onChange={(v) => {
                  const skillTable = narrative.skillTable.map((r, j) =>
                    j === i ? { ...r, simple: v } : r,
                  );
                  onChange({ ...narrative, skillTable });
                }}
              />
            </div>
          ))}
          <EditField
            label={SUMMIT_COPY.narrative.afterCourse}
            value={narrative.afterCourse}
            onChange={(v) => onChange({ ...narrative, afterCourse: v })}
          />
        </div>
      );
    case "foundation":
      return (
        <div className="flex flex-col gap-3">
          <EditField
            label={SUMMIT_COPY.narrative.listeningReading}
            value={narrative.learn.listeningReading}
            onChange={(v) => onChange({ ...narrative, learn: { ...narrative.learn, listeningReading: v } })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.writingSpeaking}
            value={narrative.learn.writingSpeaking}
            onChange={(v) => onChange({ ...narrative, learn: { ...narrative.learn, writingSpeaking: v } })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.vocabulary}
            value={narrative.learn.vocabulary}
            onChange={(v) => onChange({ ...narrative, learn: { ...narrative.learn, vocabulary: v } })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.grammar}
            value={narrative.learn.grammar}
            onChange={(v) => onChange({ ...narrative, learn: { ...narrative.learn, grammar: v } })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.goal}
            value={narrative.goal}
            onChange={(v) => onChange({ ...narrative, goal: v })}
          />
        </div>
      );
    case "intensive":
      return (
        <div className="flex flex-col gap-3">
          <EditField
            label={SUMMIT_COPY.narrative.audience}
            value={narrative.audience}
            onChange={(v) => onChange({ ...narrative, audience: v })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.goal}
            value={narrative.goal}
            onChange={(v) => onChange({ ...narrative, goal: v })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.speaking}
            value={narrative.columns.speaking}
            onChange={(v) => onChange({ ...narrative, columns: { ...narrative.columns, speaking: v } })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.writing}
            value={narrative.columns.writing}
            onChange={(v) => onChange({ ...narrative, columns: { ...narrative.columns, writing: v } })}
          />
          <EditField
            label={SUMMIT_COPY.narrative.examStrategy}
            value={narrative.columns.examStrategy}
            onChange={(v) => onChange({ ...narrative, columns: { ...narrative.columns, examStrategy: v } })}
          />
        </div>
      );
    case "support":
      return (
        <EditField
          label={SUMMIT_COPY.narrative.summary}
          value={narrative.summary}
          onChange={(v) => onChange({ ...narrative, summary: v })}
        />
      );
  }
}

function EditField({
  label,
  value,
  onChange,
  emphasized,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  emphasized?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: BRAND.color.navy }}>
      {label}
      <textarea
        rows={emphasized ? 2 : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
        style={{ borderColor: emphasized ? BRAND.color.red : `${BRAND.color.navy}33` }}
      />
    </label>
  );
}
