/**
 * Per-centre price lists (spec 005 FR-015/016, contracts/content-data.md). Content data —
 * marketing edits numbers here only. Totals are ALWAYS the arithmetic sum of stage prices
 * (clarified 2026-07-17): no discount, promo, or instalment fields exist by design.
 *
 * CentreKey resolves OFFLINE from the centre name the page loaded with the session (research
 * U1 remediation): unknown centres fall back to the default list, so the presentation never
 * blocks on data.
 *
 * ⚠ Placeholder VND values of realistic magnitude — pending official price list.
 */

import type { CourseCode } from "./courses";

export const CENTRE_KEYS = ["default"] as const;
export type CentreKey = (typeof CENTRE_KEYS)[number];

export type PriceList = Partial<Record<CourseCode, number>>;

/** VND per stage. A missing course key renders `PRICE_DISPLAY.unpricedLabelVi` (e.g. PRE_S). */
export const PRICES: Record<CentreKey, PriceList> = {
  default: {
    IF1: 9_800_000,
    IF2: 9_800_000,
    B1: 12_500_000,
    B2: 12_500_000,
    A1: 14_500_000,
    A2: 14_500_000,
    A3: 14_500_000,
    INT: 8_900_000,
    // PRE_S: học phí tư vấn riêng (no fixed price — renders unpricedLabelVi)
  },
};

export const PRICE_DISPLAY = {
  unpricedLabelVi: "liên hệ tư vấn",
} as const;

/** Map the session's centre name → price-list key; unknown centres use the default list. */
export function centreKeyForName(centreName: string): CentreKey {
  void centreName; // single price list today; per-centre rows are added here when lists diverge
  return "default";
}

/** Format VND for display (e.g. 12.500.000 ₫) — vi-VN grouping, no decimals. */
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}
