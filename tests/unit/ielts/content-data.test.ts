/**
 * T005 — content-module validation gate (contracts/content-data.md §Validation). A malformed
 * content edit fails here in CI, not in front of a family.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { LADDER, RUNGS, COURSE_CODES } from "@/lib/domain/ielts/courses";
import { CENTRE_KEYS, PRICES, PRICE_DISPLAY, centreKeyForName, formatVnd } from "@/lib/domain/ielts/pricing";
import { SUMMIT_PACE } from "@/lib/domain/ielts/bands";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { BRAND } from "@/lib/domain/ielts/brand";

describe("content data: pricing", () => {
  it("every price list belongs to a known centre key and prices only known courses", () => {
    const priceListSchema = z.partialRecord(z.enum(COURSE_CODES), z.number().int().positive());
    for (const key of Object.keys(PRICES)) {
      expect(CENTRE_KEYS).toContain(key);
      priceListSchema.parse(PRICES[key as keyof typeof PRICES]);
    }
  });

  it("every rung a climb can include is priced or explicitly unpriced (label exists)", () => {
    expect(PRICE_DISPLAY.unpricedLabelVi.length).toBeGreaterThan(0);
    for (const key of CENTRE_KEYS) {
      const list = PRICES[key];
      const pricedOrKnownUnpriced = RUNGS.every(
        (c) => typeof list[c.code] === "number" || c.code === "PRE_S",
      );
      expect(pricedOrKnownUnpriced).toBe(true);
    }
  });

  it("centreKeyForName always resolves (offline-safe fallback)", () => {
    expect(CENTRE_KEYS).toContain(centreKeyForName("Trung tâm không tồn tại"));
  });

  it("formats VND with vi-VN grouping", () => {
    expect(formatVnd(12_500_000)).toMatch(/12\.500\.000/);
  });
});

describe("content data: ladder composition (005 FR-001)", () => {
  it("foundation/booster/achiever courses carry non-empty composition lines", () => {
    for (const c of LADDER) {
      if (c.family === "foundation" || c.family === "booster-achiever") {
        expect(c.composition.length, `${c.code} composition`).toBeGreaterThan(0);
      }
    }
  });

  it("composition lines are non-empty strings", () => {
    for (const c of LADDER) {
      for (const line of c.composition) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("content data: summit pace band (005 FR-004)", () => {
  it("pace band brackets the nominal rate (range, never a point)", () => {
    expect(SUMMIT_PACE.minRate).toBeLessThan(SUMMIT_PACE.nominalRate);
    expect(SUMMIT_PACE.maxRate).toBeGreaterThan(SUMMIT_PACE.nominalRate);
  });
});

describe("content data: summit copy", () => {
  it("all copy strings are non-empty Vietnamese-bearing text", () => {
    for (const [key, value] of Object.entries(SUMMIT_COPY)) {
      const text = typeof value === "function" ? value("Minh Anh") : value;
      expect(String(text).trim().length, `SUMMIT_COPY.${key}`).toBeGreaterThan(0);
    }
  });

  it("the provisional caveat is the exact named copy (Constitution III)", () => {
    expect(SUMMIT_COPY.provisionalCaveat).toBe(
      "Lộ trình dự kiến — cần xác nhận bằng kết quả test đầu vào",
    );
  });
});

describe("content data: brand (Constitution VIII)", () => {
  it("mountain palette and mascot/tagline assets are defined", () => {
    expect(Object.keys(BRAND.mountain).length).toBeGreaterThan(0);
    expect(BRAND.asset.mascotClimber).toMatch(/^\//);
    expect(BRAND.asset.taglineLockup).toMatch(/^\//);
  });
});
