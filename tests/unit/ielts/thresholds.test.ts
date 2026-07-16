import { describe, it, expect } from "vitest";
import {
  COMPLETION_CERTIFICATE,
  WRITTEN_OUTPUT_GUARANTEE,
  COMMITMENT_THRESHOLDS,
} from "@/lib/domain/ielts/thresholds";

/**
 * US6 (T024) — the two commitment thresholds MUST be distinct and verbatim, never merged (SC-007,
 * AC-6.2). They are DIFFERENT guarantees: completion certificate (90/90) vs written output
 * guarantee (95% homework + ≤1 absence).
 */
describe("commitment thresholds: distinct & verbatim", () => {
  it("exposes exactly two distinct thresholds", () => {
    expect(COMMITMENT_THRESHOLDS).toHaveLength(2);
    expect(COMPLETION_CERTIFICATE.key).not.toBe(WRITTEN_OUTPUT_GUARANTEE.key);
    expect(COMPLETION_CERTIFICATE.title).not.toBe(WRITTEN_OUTPUT_GUARANTEE.title);
  });

  it("completion certificate states 90% attendance AND 90% homework (verbatim)", () => {
    const text = COMPLETION_CERTIFICATE.conditions.join(" | ");
    expect(text).toContain("≥ 90%");
    expect(COMPLETION_CERTIFICATE.conditions.some((c) => c.includes("chuyên cần"))).toBe(true);
    expect(COMPLETION_CERTIFICATE.conditions.some((c) => c.includes("bài tập"))).toBe(true);
  });

  it("written output guarantee is STRICTER: 95% homework AND ≤1 absence (verbatim)", () => {
    const text = WRITTEN_OUTPUT_GUARANTEE.conditions.join(" | ");
    expect(text).toContain("≥ 95%");
    expect(text).toContain("1 buổi");
  });

  it("the two thresholds share no identical condition line (never conflated)", () => {
    const overlap = COMPLETION_CERTIFICATE.conditions.filter((c) =>
      WRITTEN_OUTPUT_GUARANTEE.conditions.includes(c),
    );
    expect(overlap).toHaveLength(0);
  });
});
