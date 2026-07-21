/**
 * Discount applied on top of the Summit's arithmetic total (display-layer only — never part of
 * SummitRoadmap/SummitRequest, which stay pure per the engine's "no discount fields" design).
 * Percent clamps to 0-100; fixed amount clamps to [0, gross] so net is never negative.
 */

export type DiscountInput =
  | { type: "percent"; value: number }
  | { type: "amount"; value: number };

export interface PriceBreakdown {
  gross: number;
  off: number;
  net: number;
  hasDiscount: boolean;
}

export function applyDiscount(gross: number, discount: DiscountInput | null): PriceBreakdown {
  if (!discount) {
    return { gross, off: 0, net: gross, hasDiscount: false };
  }

  const off =
    discount.type === "percent"
      ? Math.round(gross * (Math.min(Math.max(discount.value, 0), 100) / 100))
      : Math.min(Math.max(discount.value, 0), gross);

  return { gross, off, net: gross - off, hasDiscount: off > 0 };
}
