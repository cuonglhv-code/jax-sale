import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { navItemsForRole, NAV_ITEMS } from "@/lib/domain/vocabulary";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/app/(app)");

/**
 * US2 (T032): navItemsForRole returns exactly the permitted modules per role (FR-009).
 *
 * Trimmed (2026-07-20) alongside NAV_ITEMS to only the modules that actually have a page.tsx —
 * sidebar links to not-yet-built modules were 404ing for real users. See vocabulary.ts's
 * ModuleKey comment for the re-add rule (a key returns the same slice its page.tsx lands).
 */
describe("vocabulary: navItemsForRole", () => {
  it("gives super_admin every module, including admin-only HR sub-routes", () => {
    const keys = navItemsForRole("super_admin").map((i) => i.key);
    expect(keys).toContain("hrApprovals");
    expect(keys).toContain("hrTimetable");
    expect(keys).toContain("performance");
    expect(keys).toContain("roadmap");
  });

  it("excludes performance/roadmap/hrApprovals/hrTimetable for teacher", () => {
    const keys = navItemsForRole("teacher").map((i) => i.key);
    expect(keys).not.toContain("performance");
    expect(keys).not.toContain("roadmap");
    expect(keys).not.toContain("hrApprovals");
    expect(keys).not.toContain("hrTimetable");
    // Teacher still gets the universally-available modules.
    expect(keys).toContain("tasks");
    expect(keys).toContain("hrRequests");
  });

  it("gives centre_admin performance/roadmap/hrTimetable but not hrApprovals (approver-only)", () => {
    const keys = navItemsForRole("centre_admin").map((i) => i.key);
    expect(keys).not.toContain("hrApprovals");
    expect(keys).toContain("performance");
    expect(keys).toContain("roadmap");
    expect(keys).toContain("hrTimetable");
  });

  it("every nav item's route resolves to a real page.tsx (no dead sidebar links)", () => {
    // Filesystem check, not a manually-synced allowlist — a hand-maintained list is exactly
    // what let 12 of 18 nav entries drift into 404s in the first place.
    for (const item of NAV_ITEMS) {
      const pagePath = resolve(APP_DIR, `.${item.route}`, "page.tsx");
      expect(existsSync(pagePath), `NAV_ITEMS has "${item.key}" → ${item.route} but no ${pagePath}`).toBe(
        true,
      );
    }
  });
});
