"use client";

import { useState } from "react";
import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { COMMITMENT_THRESHOLDS } from "@/lib/domain/ielts/thresholds";
import { ECOSYSTEM } from "@/lib/domain/ielts/ecosystem";
import { FAQ } from "@/lib/domain/ielts/faq";
import type { SecondaryTab } from "./summit-state";

type Props = {
  tab: SecondaryTab;
  onBack: () => void;
};

/**
 * Ecosystem / Commitments / FAQ — each one action away and one action back (spec Story 5).
 * Commitments renders both thresholds VERBATIM from `thresholds.ts` and holds no threshold text
 * of its own (Constitution IV / FR-026) — a copy edit there is the only way this view changes.
 */
export function SecondaryContent({ tab, onBack }: Props) {
  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: `${BRAND.color.navy}22` }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: BRAND.color.navy }}>
          {tab === "ecosystem" && SUMMIT_COPY.railEcosystem}
          {tab === "commitments" && SUMMIT_COPY.railCommitments}
          {tab === "faq" && SUMMIT_COPY.railFaq}
        </h2>
        <button type="button" onClick={onBack} className="rounded-lg border px-3 py-1.5 text-sm font-medium">
          {SUMMIT_COPY.railBack}
        </button>
      </div>
      {tab === "ecosystem" && <EcosystemView />}
      {tab === "commitments" && <CommitmentsView />}
      {tab === "faq" && <FaqView />}
    </section>
  );
}

function EcosystemView() {
  return (
    <ul className="flex flex-col gap-2">
      {ECOSYSTEM.map((item) => (
        <li key={item.name} className="rounded-lg border p-3" style={{ borderColor: `${BRAND.color.navy}22` }}>
          <p className="text-sm font-bold" style={{ color: BRAND.color.navy }}>{item.name}</p>
          <p className="text-sm text-neutral-600">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

function CommitmentsView() {
  return (
    <div className="flex flex-col gap-3">
      {COMMITMENT_THRESHOLDS.map((t) => (
        <div key={t.key} className="rounded-lg border-2 p-3" style={{ borderColor: BRAND.color.navy }}>
          <p className="text-sm font-bold" style={{ color: BRAND.color.navy }}>{t.title}</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {t.conditions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Chip → answer in one action; back-to-chips in one action (research D-FAQ). */
function FaqView() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = FAQ.find((f) => f.objectionKey === openKey);

  if (open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpenKey(null)}
          className="mb-2 rounded-full border px-3 py-1 text-xs font-medium"
        >
          ← {open.chipLabelVi}
        </button>
        <p className="text-sm font-bold" style={{ color: BRAND.color.navy }}>{open.questionVi}</p>
        <p className="mt-1 text-sm">{open.answerVi}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FAQ.map((f) => (
        <button
          key={f.objectionKey}
          type="button"
          onClick={() => setOpenKey(f.objectionKey)}
          className="rounded-full border px-3 py-1.5 text-sm font-medium"
          style={{ borderColor: `${BRAND.color.navy}55`, color: BRAND.color.navy }}
        >
          {f.chipLabelVi}
        </button>
      ))}
    </div>
  );
}
