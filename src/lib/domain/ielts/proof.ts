/**
 * Real-student proof (spec 005 FR-017/018, Constitution IX, contracts/content-data.md §proof.ts).
 * Content data — academic/marketing-team-editable. The consent brand is the structural barrier:
 * `ConsentedProof` carries a unique symbol that ONLY this module's internal narrowing function
 * can attach, and the module's ONLY export of proof material is `CONSENTED_PROOF` — the filtered
 * result. There is no other exported value, and no exported way to construct the brand, so a
 * component importing from this file literally cannot reach an unconsented entry: it is not a
 * runtime filter a caller could bypass, it is the only door in the wall.
 */

import type { Band } from "./bands";

declare const consented: unique symbol;

export interface ConsentedProof {
  readonly [consented]: true;
  id: string;
  displayName: string;
  photoRef: string | null;
  startBand: Band;
  resultBand: Band;
  quoteVi: string | null;
  /** Pointer to the written consent on file — never the document itself. */
  consentRef: string;
}

type Consent = { written: true; onFileRef: string } | { written: false };

interface RawProofEntry {
  id: string;
  displayName: string;
  photoRef: string | null;
  startBand: Band;
  resultBand: Band;
  quoteVi: string | null;
  consent: Consent;
}

/**
 * ⚠ PLACEHOLDER entries pending real student records + signed consent forms from the academic
 * team. Includes both consented and unconsented shapes deliberately, so the barrier below is
 * exercised by real data, not just by a test fixture.
 */
const RAW_PROOF: readonly RawProofEntry[] = [
  {
    id: "proof-01",
    displayName: "Bạn H.",
    photoRef: null,
    startBand: "4.5",
    resultBand: "7.0",
    quoteVi: "Mình từng nghĩ 7.0 là xa vời, nhưng đi từng bước theo lộ trình thì làm được.",
    consent: { written: true, onFileRef: "consent/proof-01.pdf" },
  },
  {
    id: "proof-02",
    displayName: "Bạn T.",
    photoRef: null,
    startBand: "3.5",
    resultBand: "6.0",
    quoteVi: "Nút thắt lớn nhất của mình là Writing, khóa Booster giải quyết đúng chỗ đó.",
    consent: { written: true, onFileRef: "consent/proof-02.pdf" },
  },
  {
    id: "proof-03",
    displayName: "Bạn Q.",
    photoRef: null,
    startBand: "5.5",
    resultBand: "6.5",
    quoteVi: "Lộ trình rõ ràng theo từng buổi giúp mình không bị nản giữa chừng.",
    consent: { written: true, onFileRef: "consent/proof-03.pdf" },
  },
  {
    id: "proof-04-no-consent",
    displayName: "Học viên chưa xác nhận",
    photoRef: null,
    startBand: "4.5",
    resultBand: "6.5",
    quoteVi: "Kết quả này chưa có xác nhận bằng văn bản.",
    consent: { written: false },
  },
];

function brand(entry: RawProofEntry): ConsentedProof {
  const { consent: _consent, ...rest } = entry;
  void _consent;
  return { ...rest, consentRef: (entry.consent as { onFileRef: string }).onFileRef } as ConsentedProof;
}

/** THE only renderable proof export (Constitution IX). Unconsented entries are absent, not hidden. */
export const CONSENTED_PROOF: readonly ConsentedProof[] = RAW_PROOF.filter(
  (e): e is RawProofEntry & { consent: { written: true; onFileRef: string } } => e.consent.written,
).map(brand);
