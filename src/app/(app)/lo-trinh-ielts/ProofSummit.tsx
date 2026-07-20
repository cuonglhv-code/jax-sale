"use client";

import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { bandLabel } from "@/lib/domain/ielts/labels";
import { CONSENTED_PROOF } from "@/lib/domain/ielts/proof";
import { matchProof } from "@/services/ielts/proof-match";
import type { Band } from "@/lib/domain/ielts/bands";

type Props = {
  currentBand: Band;
  targetBand: Band;
};

/**
 * The summit's proof (spec Story 4). Accepts only `CONSENTED_PROOF` — the module's sole export
 * — so an unconsented record cannot reach this component by any path (Constitution IX). Matched
 * proof surfaces first; a nearest match never claims to be the family's exact journey.
 */
export function ProofSummit({ currentBand, targetBand }: Props) {
  const matches = matchProof({ startBand: currentBand, targetBand }, CONSENTED_PROOF);
  const top = matches[0];
  if (!top) return null;

  return (
    <section
      aria-label={SUMMIT_COPY.proofTitle}
      className="rounded-2xl border p-5"
      style={{ borderColor: `${BRAND.color.navy}22`, backgroundColor: `${BRAND.mountain.summitGlow}22` }}
    >
      <h2 className="mb-1 text-lg font-bold" style={{ color: BRAND.color.navy }}>
        {SUMMIT_COPY.proofTitle}
      </h2>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.color.red }}>
        {top.matchKind === "exact" ? SUMMIT_COPY.proofExactMatch : SUMMIT_COPY.proofNearestMatch}
      </p>
      <div className="flex items-start gap-3">
        {top.proof.photoRef && (
          // eslint-disable-next-line @next/next/no-img-element -- proof photos are content-data refs, not next/image-optimized assets
          <img
            src={top.proof.photoRef}
            alt=""
            aria-hidden
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        )}
        <div>
          <p className="text-sm font-bold">{top.proof.displayName}</p>
          <p className="text-xs text-neutral-600">
            {bandLabel(top.proof.startBand)} → {bandLabel(top.proof.resultBand)}
          </p>
          {top.proof.quoteVi && <p className="mt-1 text-sm italic">&ldquo;{top.proof.quoteVi}&rdquo;</p>}
        </div>
      </div>
    </section>
  );
}
