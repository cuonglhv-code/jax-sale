import { describe, it, expect } from "vitest";
import { navItemsForRole } from "@/lib/domain/vocabulary";

/** US2 (T032): navItemsForRole returns exactly the permitted modules per role (FR-009). */
describe("vocabulary: navItemsForRole", () => {
  it("gives super_admin every module, including personnel/workflows", () => {
    const keys = navItemsForRole("super_admin").map((i) => i.key);
    expect(keys).toContain("personnel");
    expect(keys).toContain("workflows");
    expect(keys).toContain("leads");
  });

  it("excludes leads/team/settings/personnel/workflows/performance for teacher", () => {
    const keys = navItemsForRole("teacher").map((i) => i.key);
    expect(keys).not.toContain("leads");
    expect(keys).not.toContain("team");
    expect(keys).not.toContain("settings");
    expect(keys).not.toContain("personnel");
    expect(keys).not.toContain("workflows");
    expect(keys).not.toContain("performance");
    expect(keys).not.toContain("performanceActivity");
    // Teacher still gets the universally-available modules.
    expect(keys).toContain("tasks");
    expect(keys).toContain("dashboard");
  });

  it("excludes personnel/workflows for centre_admin but includes performance (slice #003 FR-ACCESS-01)", () => {
    const keys = navItemsForRole("centre_admin").map((i) => i.key);
    expect(keys).not.toContain("personnel");
    expect(keys).not.toContain("workflows");
    expect(keys).toContain("performance");
    expect(keys).toContain("settings");
    expect(keys).toContain("leads");
  });
});
