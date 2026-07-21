import { describe, it, expect } from "vitest";
import { applyDiscount } from "@/lib/domain/ielts/pricing-discount";

describe("applyDiscount", () => {
  it("returns the gross total unchanged with no discount", () => {
    const result = applyDiscount(10_000_000, null);
    expect(result).toEqual({ gross: 10_000_000, off: 0, net: 10_000_000, hasDiscount: false });
  });

  it("applies a percent discount", () => {
    const result = applyDiscount(10_000_000, { type: "percent", value: 15 });
    expect(result).toEqual({ gross: 10_000_000, off: 1_500_000, net: 8_500_000, hasDiscount: true });
  });

  it("applies a fixed-amount discount", () => {
    const result = applyDiscount(10_000_000, { type: "amount", value: 2_000_000 });
    expect(result).toEqual({ gross: 10_000_000, off: 2_000_000, net: 8_000_000, hasDiscount: true });
  });

  it("clamps percent to 0-100", () => {
    const over = applyDiscount(10_000_000, { type: "percent", value: 150 });
    expect(over).toEqual({ gross: 10_000_000, off: 10_000_000, net: 0, hasDiscount: true });

    const under = applyDiscount(10_000_000, { type: "percent", value: -20 });
    expect(under).toEqual({ gross: 10_000_000, off: 0, net: 10_000_000, hasDiscount: false });
  });

  it("clamps a fixed amount to [0, gross] so net never goes negative", () => {
    const over = applyDiscount(10_000_000, { type: "amount", value: 99_000_000 });
    expect(over).toEqual({ gross: 10_000_000, off: 10_000_000, net: 0, hasDiscount: true });

    const under = applyDiscount(10_000_000, { type: "amount", value: -5_000_000 });
    expect(under).toEqual({ gross: 10_000_000, off: 0, net: 10_000_000, hasDiscount: false });
  });

  it("a zero-value discount of either type reports hasDiscount: false", () => {
    expect(applyDiscount(10_000_000, { type: "percent", value: 0 }).hasDiscount).toBe(false);
    expect(applyDiscount(10_000_000, { type: "amount", value: 0 }).hasDiscount).toBe(false);
  });
});
