/**
 * T033 — Proof consent barrier + journey matching (Constitution IX, spec FR-017/018). The brand
 * on `ConsentedProof` is unconstructible outside proof.ts; this suite proves the barrier holds
 * (mirroring internal-warning-barrier.test.ts's compile-time pattern) and that matching ranks
 * correctly without ever mislabeling a nearest match as exact.
 */

import { describe, it, expect } from "vitest";
import { CONSENTED_PROOF } from "@/lib/domain/ielts/proof";
import { matchProof } from "@/services/ielts/proof-match";

describe("proof consent barrier (Constitution IX)", () => {
  it("CONSENTED_PROOF contains only entries with written consent — the placeholder unconsented entry is absent", () => {
    expect(CONSENTED_PROOF.length).toBeGreaterThan(0);
    expect(CONSENTED_PROOF.some((p) => p.id === "proof-04-no-consent")).toBe(false);
  });

  it("every consented entry carries a consentRef pointer, never the raw consent object", () => {
    for (const p of CONSENTED_PROOF) {
      expect(typeof p.consentRef).toBe("string");
      expect(p.consentRef.length).toBeGreaterThan(0);
      expect("consent" in p).toBe(false); // the raw {written, onFileRef} shape never survives
    }
  });

  it("the module exports nothing else proof-shaped (no RAW_PROOF, no brand constructor)", async () => {
    const mod = await import("@/lib/domain/ielts/proof");
    expect(Object.keys(mod)).toEqual(["CONSENTED_PROOF"]);
  });
});

describe("matchProof: exact vs nearest (contracts/summit-engine.md)", () => {
  it("an exact journey match (4.5→7.0) is labelled exact and ranks first", () => {
    const matches = matchProof({ startBand: "4.5", targetBand: "7.0" }, CONSENTED_PROOF);
    expect(matches[0].matchKind).toBe("exact");
    expect(matches[0].proof.startBand).toBe("4.5");
    expect(matches[0].proof.resultBand).toBe("7.0");
  });

  it("no exact match → nearest is returned, never labelled exact", () => {
    const matches = matchProof({ startBand: "4.5", targetBand: "6.5" }, CONSENTED_PROOF);
    expect(matches[0].matchKind).toBe("nearest");
  });

  it("results are ordered best-first by journey distance", () => {
    const matches = matchProof({ startBand: "3.5", targetBand: "6.0" }, CONSENTED_PROOF);
    const distances = matches.map(
      (m) =>
        Math.abs(m.proof.startBand === "3.5" ? 0 : 1) + Math.abs(m.proof.resultBand === "6.0" ? 0 : 1),
    );
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("empty pool returns no matches (graceful, never throws)", () => {
    expect(matchProof({ startBand: "4.5", targetBand: "7.0" }, [])).toEqual([]);
  });
});
